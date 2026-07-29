import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import Book from '@/models/Book';
import User from '@/models/User';
import Rating from '@/models/Rating';
import { verifyToken } from '@/lib/jwt';
import { buildUserPreferences, contentBasedScores, collaborativeScores, hybridRank } from '@/lib/recommendations';

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

    const allBooks = await Book.find({}).lean();
    const allUsers = await User.find({}, 'favorites').lean();
    const allRatings = await Rating.find({}).lean();

    const ratingsByUser = new Map<string, { bookId: string; value: number }[]>();
    allRatings.forEach((r: any) => {
      const uid = r.userId.toString();
      if (!ratingsByUser.has(uid)) ratingsByUser.set(uid, []);
      ratingsByUser.get(uid)!.push({ bookId: r.bookId.toString(), value: r.value });
    });

    const allUserPreferences = new Map<string, Map<string, number>>();
    allUsers.forEach((u: any) => {
      const uid = u._id.toString();
      const favIds = (u.favorites || []).map((id: any) => id.toString());
      const userRatings = ratingsByUser.get(uid) || [];
      allUserPreferences.set(uid, buildUserPreferences(favIds, userRatings));
    });

    const myPrefs = allUserPreferences.get(userId) || new Map();
    const myFavoriteIds = new Set(myPrefs.keys());

    const booksMapAll = new Map(allBooks.map((b: any) => [b._id.toString(), b]));

    const likedBooks = Array.from(myPrefs.entries())
      .filter(([, w]) => w >= 0.6)
      .map(([bookId]) => booksMapAll.get(bookId))
      .filter(Boolean);

    const candidates = allBooks.filter((b: any) => !myFavoriteIds.has(b._id.toString()));

    let ranked;
    const personalized = likedBooks.length > 0;

    if (!personalized) {
      ranked = candidates
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map((b: any) => ({ bookId: b._id.toString(), score: 0 }));
    } else {
      const contentScores = contentBasedScores(
        likedBooks.map((b: any) => ({ _id: b._id.toString(), genre: b.genre, author: b.author, year: b.year })),
        candidates.map((b: any) => ({ _id: b._id.toString(), genre: b.genre, author: b.author, year: b.year })),
        myPrefs
      );

      const collabScores = collaborativeScores(
        userId,
        allUserPreferences,
        candidates.map((b: any) => b._id.toString())
      );

      ranked = hybridRank(contentScores, collabScores, 0.7);
    }

    const topBookIds = ranked.slice(0, 12).map(r => r.bookId);
    const recommendedBooks = topBookIds.map(id => booksMapAll.get(id)).filter(Boolean);

    return NextResponse.json({ books: recommendedBooks, personalized }, { status: 200 });
  } catch (error: any) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}