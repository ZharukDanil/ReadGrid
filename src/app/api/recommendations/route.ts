import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import Book from '@/models/Book';
import User from '@/models/User';
import Rating from '@/models/Rating';
import { verifyToken } from '@/lib/jwt';
import {
  buildUserPreferences,
  contentBasedScores,
  genrePreferenceScores,
  communityScores,
  hybridRankFull,
} from '@/lib/recommendations';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = payload.userId;

    const [allBooks, myRatings, currentUser] = await Promise.all([
      Book.find({}).select('-fileUrl').lean(),
      Rating.find({ userId }).lean(),
      User.findById(userId, 'favorites preferredGenres').lean(),
    ]);

    const favIds = ((currentUser as any)?.favorites || []).map((id: any) => id.toString());
    const myRatingsList = myRatings.map((r: any) => ({
      bookId: r.bookId.toString(),
      value: r.value,
    }));

    const myPrefs = buildUserPreferences(favIds, myRatingsList);
    const myFavoriteIds = new Set(myPrefs.keys());

    const booksMapAll = new Map(allBooks.map((b: any) => [b._id.toString(), b]));

    const likedBooks = Array.from(myPrefs.entries())
      .filter(([, w]) => w >= 0.6)
      .map(([bookId]) => booksMapAll.get(bookId))
      .filter(Boolean);

    const candidates = allBooks.filter((b: any) => !myFavoriteIds.has(b._id.toString()));

    const preferredGenres: string[] = (currentUser as any)?.preferredGenres || [];
    const hasLikes = likedBooks.length > 0;
    const hasGenrePrefs = preferredGenres.length > 0;

    // Показуємо онбординг лише коли взагалі немає жодного сигналу
    const needsOnboarding = !hasLikes && !hasGenrePrefs;

    // Порівняння за входженням підрядка в обидва боки: обраний жанр
    // "фентезі" має збігатися з жанром книги "епічне фентезі" й навпаки.
    const prefTokens = preferredGenres.map(g => g.toLowerCase().trim()).filter(Boolean);
    const tokenMatches = (prefToken: string, candidateToken: string): boolean => {
      if (!prefToken || !candidateToken) return false;
      return candidateToken.includes(prefToken) || prefToken.includes(candidateToken);
    };
    const matchesPreferredGenre = (bookId: string): boolean => {
      const book = booksMapAll.get(bookId);
      if (!book) return false;
      const tokens = ((book as any).genre || '')
        .toLowerCase()
        .split(/[\/,]/)
        .map((g: string) => g.trim())
        .filter(Boolean);
      return tokens.some((t: string) => prefTokens.some(p => tokenMatches(p, t)));
    };

    let ranked: { bookId: string; score: number }[];

    if (hasLikes) {
      const contentScores = contentBasedScores(
        likedBooks.map((b: any) => ({
          _id: b._id.toString(), genre: b.genre, author: b.author, year: b.year, description: b.description,
        })),
        candidates.map((b: any) => ({
          _id: b._id.toString(), genre: b.genre, author: b.author, year: b.year, description: b.description,
        })),
        myPrefs
      );

      const genreScores = genrePreferenceScores(
        preferredGenres,
        candidates.map((b: any) => ({ _id: b._id.toString(), genre: b.genre, author: b.author, year: b.year }))
      );

      // Колаборативний сигнал на основі агрегованих оцінок усіх читачів
      const communityScoresArr = communityScores(
        candidates.map((b: any) => ({ _id: b._id.toString(), avgRating: b.avgRating, ratingsCount: b.ratingsCount }))
      );

      const fullRanked = hybridRankFull(contentScores, genreScores, communityScoresArr);

      if (hasGenrePrefs) {
        // Явний сигнал (ручний вибір жанрів) — фільтруємо кандидатів
        // за збігом жанру, а всередині цього набору ранжуємо за
        // схожістю з улюбленими книгами (жанр + автор). Якщо під
        // обрані жанри книг замало — доповнюємо рештою, але
        // відфільтровані завжди йдуть першими.
        const filtered = fullRanked.filter(r => matchesPreferredGenre(r.bookId));

        if (filtered.length >= 12) {
          ranked = filtered;
        } else {
          const filteredIds = new Set(filtered.map(r => r.bookId));
          const rest = fullRanked.filter(r => !filteredIds.has(r.bookId));
          ranked = [...filtered, ...rest];
        }
      } else {
        ranked = fullRanked;
      }
    } else if (hasGenrePrefs) {
      // Є обрані жанри, але немає ні лайків, ні оцінок цього користувача.
      // Ранжуємо за жанром (0.75) + думкою спільноти (0.25). Якщо ж у
      // спільноти взагалі немає жодної оцінки — community-складова всюди
      // дорівнює 0, і тоді покладаємось лише на жанровий збіг; а якщо й
      // серед відфільтрованих кандидатів усе однаково (score 0 у всіх),
      // підстраховуємось сортуванням за датою додавання.
      const genreScores = genrePreferenceScores(
        preferredGenres,
        candidates.map((b: any) => ({ _id: b._id.toString(), genre: b.genre, author: b.author, year: b.year }))
      );

      const communityScoresArr = communityScores(
        candidates.map((b: any) => ({ _id: b._id.toString(), avgRating: b.avgRating, ratingsCount: b.ratingsCount }))
      );

      const hasAnyRatings = communityScoresArr.some(s => s.score > 0);

      const genreMap = new Map(genreScores.map(s => [s.bookId, s.score]));
      const communityMap = new Map(communityScoresArr.map(s => [s.bookId, s.score]));

      const combined = candidates.map((b: any) => {
        const id = b._id.toString();
        const g = genreMap.get(id) || 0;
        const cm = communityMap.get(id) || 0;
        return { bookId: id, score: g * 0.75 + cm * 0.25, createdAt: b.createdAt };
      });

      const hasAnyScoreSpread = combined.some(r => r.score > 0);

      if (hasAnyScoreSpread) {
        ranked = combined.sort((a, b) => b.score - a.score);
      } else {
        // Ні жанр, ні спільнота нічого не дали розрізнити — відкат на новинки
        ranked = combined
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .map(r => ({ bookId: r.bookId, score: 0 }));
      }
    } else {
      // Повний холодний старт: немає ні історії, ні обраних жанрів —
      // покладаємось на думку спільноти (агреговані оцінки), а якщо
      // взагалі ні в кого немає жодної оцінки — відкатуємось на новинки.
      const communityScoresArr = communityScores(
        candidates.map((b: any) => ({ _id: b._id.toString(), avgRating: b.avgRating, ratingsCount: b.ratingsCount }))
      );

      const hasAnyRatings = communityScoresArr.some(s => s.score > 0);

      if (hasAnyRatings) {
        ranked = communityScoresArr.sort((a, b) => b.score - a.score);
      } else {
        ranked = candidates
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .map((b: any) => ({ bookId: b._id.toString(), score: 0 }));
      }
    }

    const topBookIds = ranked.slice(0, 12).map(r => r.bookId);
    const recommendedBooks = topBookIds.map(id => booksMapAll.get(id)).filter(Boolean);

    return NextResponse.json(
      {
        books: recommendedBooks,
        personalized: hasLikes,
        usingGenrePrefs: !hasLikes && hasGenrePrefs,
        needsOnboarding,
        preferredGenres,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}