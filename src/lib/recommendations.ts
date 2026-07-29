type BookLite = {
    _id: string;
    genre: string;
    author: string;
    year: number;
  };
  
  type ScoredBook = {
    bookId: string;
    score: number;
  };
  
  type UserPreferences = Map<string, number>; // bookId -> вага інтересу (0..1)
  
  function genreTokens(genre: string): string[] {
    return genre
      .toLowerCase()
      .split(/[\/,]/)
      .map(g => g.trim())
      .filter(Boolean);
  }
  
  function genreSimilarity(a: string, b: string): number {
    const setA = new Set(genreTokens(a));
    const setB = new Set(genreTokens(b));
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    setA.forEach(g => { if (setB.has(g)) intersection++; });
    const union = new Set([...setA, ...setB]).size;
    return intersection / union;
  }
  
  /**
   * Об'єднує "обране" і "оцінки" користувача в єдину карту ваг інтересу.
   * Оцінка (1-5) дає точнішу вагу, ніж просто факт додавання в обране.
   * Якщо книга і в обраному, і оцінена — беремо вагу оцінки (вона точніша).
   */
  export function buildUserPreferences(
    favoriteBookIds: string[],
    ratings: { bookId: string; value: number }[]
  ): UserPreferences {
    const prefs: UserPreferences = new Map();
  
    favoriteBookIds.forEach(id => prefs.set(id, 0.8)); // сильний, але неточний сигнал
  
    ratings.forEach(r => {
      prefs.set(r.bookId, r.value / 5); // точний сигнал перекриває "обране"
    });
  
    return prefs;
  }
  
  /**
   * КОНТЕНТНА ФІЛЬТРАЦІЯ
   * likedBooks — книги користувача з вагою інтересу >= 0.6 (тобто оцінка 3+ або обране)
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
        let s = genreSimilarity(candidate.genre, liked.genre);
        if (candidate.author.toLowerCase() === liked.author.toLowerCase()) {
          s += 0.5;
        }
        total += s * w;
        weightSum += w;
      }
  
      return { bookId: candidate._id, score: weightSum > 0 ? total / weightSum : 0 };
    });
  }
  
  /**
   * КОЛАБОРАТИВНА ФІЛЬТРАЦІЯ (user-based, зважена косинусна схожість)
   * allUserPreferences: Map<userId, UserPreferences>
   */
  export function collaborativeScores(
    currentUserId: string,
    allUserPreferences: Map<string, UserPreferences>,
    candidateBookIds: string[]
  ): ScoredBook[] {
    const myPrefs = allUserPreferences.get(currentUserId) || new Map();
    const scores = new Map<string, number>();
    candidateBookIds.forEach(id => scores.set(id, 0));
  
    if (myPrefs.size === 0) {
      return Array.from(scores.entries()).map(([bookId, score]) => ({ bookId, score }));
    }
  
    allUserPreferences.forEach((theirPrefs, otherUserId) => {
      if (otherUserId === currentUserId || theirPrefs.size === 0) return;
  
      // Косинусна схожість між векторами інтересів
      let dot = 0;
      let myNorm = 0;
      let theirNorm = 0;
  
      myPrefs.forEach((w, bookId) => {
        myNorm += w * w;
        const theirW = theirPrefs.get(bookId);
        if (theirW) dot += w * theirW;
      });
      theirPrefs.forEach(w => { theirNorm += w * w; });
  
      if (myNorm === 0 || theirNorm === 0) return;
      const similarity = dot / (Math.sqrt(myNorm) * Math.sqrt(theirNorm));
      if (similarity <= 0) return;
  
      theirPrefs.forEach((w, bookId) => {
        if (myPrefs.has(bookId)) return; // вже знайомі
        if (scores.has(bookId)) {
          scores.set(bookId, (scores.get(bookId) || 0) + similarity * w);
        }
      });
    });
  
    return Array.from(scores.entries()).map(([bookId, score]) => ({ bookId, score }));
  }
  
  /**
   * ГІБРИДНЕ ОБ'ЄДНАННЯ
   */
  export function hybridRank(
    contentScores: ScoredBook[],
    collaborativeScores: ScoredBook[],
    alpha = 0.7
  ): ScoredBook[] {
    const contentMap = new Map(contentScores.map(s => [s.bookId, s.score]));
    const collabMap = new Map(collaborativeScores.map(s => [s.bookId, s.score]));
  
    const allIds = new Set([...contentMap.keys(), ...collabMap.keys()]);
    const result: ScoredBook[] = [];
  
    allIds.forEach(id => {
      const c = contentMap.get(id) || 0;
      const cf = collabMap.get(id) || 0;
      result.push({ bookId: id, score: alpha * c + (1 - alpha) * cf });
    });
  
    return result.sort((a, b) => b.score - a.score);
  }