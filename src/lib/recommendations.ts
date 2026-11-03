type BookLite = {
  _id: string;
  genre: string;
  author: string;
  year: number;
  description?: string;
};

type ScoredBook = {
  bookId: string;
  score: number;
};

type UserPreferences = Map<string, number>;

function genreTokens(genre: string): string[] {
  return genre
    .toLowerCase()
    .split(/[\/,]/)
    .map(g => g.trim())
    .filter(Boolean);
}

// Порівняння не за точним збігом токена, а за входженням підрядка в обидва
// боки: "фентезі" має збігатися з "епічне фентезі", і навпаки.
function genreTokenMatches(prefToken: string, candidateToken: string): boolean {
  if (!prefToken || !candidateToken) return false;
  return candidateToken.includes(prefToken) || prefToken.includes(candidateToken);
}

function genreSimilarity(a: string, b: string): number {
  const setA = new Set(genreTokens(a));
  const setB = new Set(genreTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  let matches = 0;
  setA.forEach(ta => {
    setB.forEach(tb => {
      if (genreTokenMatches(ta, tb)) matches++;
    });
  });
  const union = setA.size + setB.size;
  return union > 0 ? (2 * matches) / union : 0;
}

export function buildUserPreferences(
  favoriteBookIds: string[],
  ratings: { bookId: string; value: number }[]
): UserPreferences {
  const prefs: UserPreferences = new Map();
  favoriteBookIds.forEach(id => prefs.set(id, 0.8));
  ratings.forEach(r => prefs.set(r.bookId, r.value / 5));
  return prefs;
}

/**
 * КОНТЕНТНА ФІЛЬТРАЦІЯ (спрощена): схожість книги-кандидата з кожною
 * книгою, яку користувач вподобав/оцінив, рахується лише за жанром
 * та автором — без аналізу тексту описів.
 * Схожість = 0.6 * жанрова схожість + 0.4 * бонус за того самого автора.
 */
export function contentBasedScores(
  likedBooks: BookLite[],
  candidateBooks: BookLite[],
  weights: UserPreferences
): ScoredBook[] {
  if (likedBooks.length === 0) {
    return candidateBooks.map(b => ({ bookId: b._id, score: 0 }));
  }

  return candidateBooks.map(candidate => {
    let total = 0;
    let weightSum = 0;

    for (const liked of likedBooks) {
      const w = weights.get(liked._id) || 0.5;

      const genreSim = genreSimilarity(candidate.genre, liked.genre);
      const isAuthorMatch = candidate.author.toLowerCase() === liked.author.toLowerCase();

      const s = genreSim * 0.6 + (isAuthorMatch ? 0.4 : 0);

      total += s * w;
      weightSum += w;
    }

    return { bookId: candidate._id, score: weightSum > 0 ? total / weightSum : 0 };
  });
}

/**
 * ЖАНРОВИЙ БОНУС на основі жанрів, обраних користувачем вручну.
 * Порівняння за входженням підрядка ("фентезі" збігається з
 * "епічне фентезі"), а не лише за повним текстовим збігом.
 */
export function genrePreferenceScores(
  preferredGenres: string[],
  candidateBooks: BookLite[]
): ScoredBook[] {
  const prefTokens = preferredGenres.map(g => g.toLowerCase().trim()).filter(Boolean);
  if (prefTokens.length === 0) {
    return candidateBooks.map(b => ({ bookId: b._id, score: 0 }));
  }

  return candidateBooks.map(candidate => {
    const tokens = genreTokens(candidate.genre);
    const matchedCount = tokens.filter(t =>
      prefTokens.some(p => genreTokenMatches(p, t))
    ).length;
    const maxPossible = Math.max(tokens.length, 1);
    return { bookId: candidate._id, score: matchedCount / maxPossible };
  });
}

/**
 * ГІБРИДНЕ ОБ'ЄДНАННЯ двох сигналів: контентного (жанр+автор
 * улюблених книг) та ручного жанрового. Ваги: 0.7 контент,
 * 0.3 жанровий бонус.
 */
export function hybridRank(
  contentScores: ScoredBook[],
  genreScores: ScoredBook[]
): ScoredBook[] {
  const contentMap = new Map(contentScores.map(s => [s.bookId, s.score]));
  const genreMap = new Map(genreScores.map(s => [s.bookId, s.score]));

  const allIds = new Set([...contentMap.keys(), ...genreMap.keys()]);
  const result: ScoredBook[] = [];

  allIds.forEach(id => {
    const c = contentMap.get(id) || 0;
    const g = genreMap.get(id) || 0;
    result.push({ bookId: id, score: c * 0.7 + g * 0.3 });
  });

  return result.sort((a, b) => b.score - a.score);
}

type CommunityBook = {
  _id: string;
  avgRating?: number;
  ratingsCount?: number;
};

/**
 * КОЛАБОРАТИВНИЙ СИГНАЛ (неперсоналізований, "мудрість натовпу").
 * Використовує вже агреговані оцінки ВСІХ користувачів (Book.avgRating,
 * Book.ratingsCount), а не власну матрицю "користувач-користувач" — це
 * значно дешевше обчислювально, але все ще є справжнім колаборативним
 * сигналом, бо ґрунтується на думках багатьох різних читачів.
 *
 * Використовується формула зваженого рейтингу (аналог IMDB Top 250):
 * WR = (v / (v+m)) * R + (m / (v+m)) * C
 * де R — середня оцінка книги, v — кількість оцінок,
 *     C — середня оцінка по всьому каталогу, m — поріг довіри.
 * Це запобігає ситуації, коли книга з однією оцінкою "5" обходить книгу
 * з 50 оцінками "4.8".
 */
export function communityScores(
  books: CommunityBook[],
  minVotes = 3
): ScoredBook[] {
  const ratedBooks = books.filter(b => (b.ratingsCount || 0) > 0);
  const C = ratedBooks.length > 0
    ? ratedBooks.reduce((sum, b) => sum + (b.avgRating || 0), 0) / ratedBooks.length
    : 0;

  return books.map(b => {
    const v = b.ratingsCount || 0;
    const R = b.avgRating || 0;
    const wr = v > 0 ? (v / (v + minVotes)) * R + (minVotes / (v + minVotes)) * C : 0;
    return { bookId: b._id, score: wr / 5 }; // нормалізуємо до 0..1, як і інші сигнали
  });
}

/**
 * ГІБРИДНЕ ОБ'ЄДНАННЯ трьох сигналів:
 * 0.55 контентний (жанр+автор улюблених книг) +
 * 0.25 ручний жанровий вибір +
 * 0.20 колаборативний (агреговані оцінки спільноти)
 */
export function hybridRankFull(
  contentScores: ScoredBook[],
  genreScores: ScoredBook[],
  communityScoresArr: ScoredBook[]
): ScoredBook[] {
  const contentMap = new Map(contentScores.map(s => [s.bookId, s.score]));
  const genreMap = new Map(genreScores.map(s => [s.bookId, s.score]));
  const communityMap = new Map(communityScoresArr.map(s => [s.bookId, s.score]));

  const allIds = new Set([...contentMap.keys(), ...genreMap.keys(), ...communityMap.keys()]);
  const result: ScoredBook[] = [];

  allIds.forEach(id => {
    const c = contentMap.get(id) || 0;
    const g = genreMap.get(id) || 0;
    const cm = communityMap.get(id) || 0;
    result.push({ bookId: id, score: c * 0.55 + g * 0.25 + cm * 0.20 });
  });

  return result.sort((a, b) => b.score - a.score);
}