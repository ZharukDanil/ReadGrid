'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WebBackground from '@/components/WebBackground';
import { useToast } from '@/components/Toast/ToastContext';
import { downloadBook } from '@/lib/downloadBook';

type Book = {
  _id: string;
  title: string;
  author: string;
  genre: string;
  year: number;
  description: string;
  coverUrl: string;
  isPremium?: boolean;
};

type DecodedToken = {
  userId: string;
  username: string;
  role: string;
  exp: number;
};

function decodeJWT(token: string): DecodedToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default function RecommendationsPage() {
  const { showToast } = useToast();

  const [books, setBooks] = useState<Book[]>([]);
  const [personalized, setPersonalized] = useState(false);
  const [usingGenrePrefs, setUsingGenrePrefs] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [username, setUsername] = useState('');

  const [genrePanelOpen, setGenrePanelOpen] = useState(false);
  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [savingGenres, setSavingGenres] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumChecked, setPremiumChecked] = useState(false);
  const [role, setRole] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('readgrid_token');
    if (!token) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    try {
      const decoded = decodeJWT(token);
      if (!decoded || decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('readgrid_token');
        setIsAuthorized(false);
        setLoading(false);
      } else {
        setUsername(decoded.username);
        setRole(decoded.role);
        setIsAuthorized(true);
        fetchRecommendations(token);
        fetchUserPremiumStatus(decoded.userId, token);
        fetchFavorites(token);
      }
    } catch {
      setIsAuthorized(false);
      setLoading(false);
    }
  }, []);

  const fetchRecommendations = async (token: string) => {
    try {
      const res = await fetch('/api/recommendations', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books || []);
        setPersonalized(data.personalized || false);
        setUsingGenrePrefs(data.usingGenrePrefs || false);
        setNeedsOnboarding(data.needsOnboarding || false);
        setSelectedGenres(data.preferredGenres || []);
      }
    } catch (error) {
      console.error('Fetch recommendations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGenres = async () => {
    try {
      const res = await fetch('/api/genres', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAvailableGenres(data.genres || []);
      }
    } catch (error) {
      console.error('Fetch genres error:', error);
    }
  };

  const fetchUserPremiumStatus = async (userId: string, token: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsPremium(data.isPremium || false);
      }
    } catch (error) {
      console.error('Premium status error:', error);
    } finally {
      setPremiumChecked(true);
    }
  };

  const fetchFavorites = async (token: string) => {
    try {
      const res = await fetch('/api/favorites', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites((data.favorites || []).map((b: Book) => b._id));
      }
    } catch (error) {
      console.error('Fetch favorites error:', error);
    }
  };

  const toggleFavorite = async (bookId: string) => {
    const token = localStorage.getItem('readgrid_token');
    if (!token) return;
    const isFav = favorites.includes(bookId);
    try {
      const res = isFav
        ? await fetch(`/api/favorites?bookId=${bookId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        : await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bookId }),
        });
      if (res.ok) {
        setFavorites(prev => (isFav ? prev.filter(id => id !== bookId) : [...prev, bookId]));
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const canDownload = (book: Book) =>
    !book.isPremium || isPremium || role === 'admin' || role === 'superadmin' || !premiumChecked;

  const openGenrePanel = () => {
    if (availableGenres.length === 0) fetchGenres();
    setGenrePanelOpen(true);
  };

  const cardBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    padding: '0.6rem 0.5rem',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    fontWeight: 'normal',
    letterSpacing: 'normal',
    cursor: 'pointer',
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : prev.length < 5
          ? [...prev, genre]
          : prev
    );
  };

  const saveGenresAndRefresh = async () => {
    setSavingGenres(true);

    const token = localStorage.getItem('readgrid_token');
    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ genres: selectedGenres }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setGenrePanelOpen(false);
        showToast(selectedGenres.length === 0 ? 'Жанри скинуто' : 'Жанри збережено', 'success');
        setLoading(true);
        // якщо зберегли порожній список — не даємо примусовому онбордингу
        // одразу вискочити знову, навіть якщо лайків теж немає
        if (selectedGenres.length === 0) {
          setDismissedThisVisit(true);
        }
        await fetchRecommendations(token!);
      } else {
        console.error('Save genres failed:', res.status, data);
        showToast(data.message || `Помилка збереження (код ${res.status})`, 'error');
      }
    } catch (error) {
      console.error('Save genres error:', error);
      showToast('Помилка мережі під час збереження', 'error');
    } finally {
      setSavingGenres(false);
    }
  };

  // просто локально знімає всі галочки, без звернення до сервера
  const clearSelection = () => {
    setSelectedGenres([]);
  };

  const showOnboarding = (needsOnboarding && !dismissedThisVisit) || genrePanelOpen;

  useEffect(() => {
    if (needsOnboarding && !dismissedThisVisit) {
      fetchGenres();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOnboarding]);

  if (!isAuthorized && !loading) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '4rem' }}>
        <h1 style={{ color: '#f8d9a6', fontSize: '2rem', marginBottom: '1rem' }}>🔒 Доступ заборонено</h1>
        <p style={{ color: '#caa98a', fontSize: '1.2rem', marginBottom: '2rem' }}>
          Увійдіть, щоб побачити персональні рекомендації
        </p>
        <Link href="/login" className="nav-btn">🔑 Увійти</Link>
      </div>
    );
  }

  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <WebBackground />

      <div style={{
        position: 'absolute', top: 0, left: 0, width: '85px', height: '100%',
        backgroundImage: 'url("/side-left.png")', backgroundRepeat: 'repeat-y',
        backgroundSize: 'contain', opacity: 0.1, filter: 'blur(0.3px) brightness(1.1)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '85px', height: '100%',
        backgroundImage: 'url("/side-right.png")', backgroundRepeat: 'repeat-y',
        backgroundSize: 'contain', opacity: 0.1, filter: 'blur(0.3px) brightness(1.1)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <Link href="/" className="nav-btn" style={{ marginBottom: '2rem', display: 'inline-block' }}>
        ⬅️ На головну
      </Link>

      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p className="welcome-title fade-in-left">
          <span className="welcome-emoji">✨</span> Рекомендовано для вас
        </p>
        <div className="welcome-divider"></div>
        <p className="welcome-subtitle fade-in-right">
          <span className="welcome-emoji">👋</span> {username}, ось книги, підібрані спеціально для тебе
        </p>
      </div>

      {/* Кнопка "Змінити жанри" — завжди видна */}
      {!showOnboarding && (
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <button
            onClick={openGenrePanel}
            style={{
              padding: '0.6rem 1.3rem',
              background: 'rgba(212,162,59,0.12)',
              color: '#d4a23b',
              border: '1px solid rgba(212,162,59,0.35)',
              borderRadius: '20px',
              fontWeight: 600,
              fontFamily: 'Merriweather, serif',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212,162,59,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(212,162,59,0.12)'; }}
          >
            🎯 Змінити жанри інтересів
          </button>
        </div>
      )}

      {/* Панель вибору жанрів — і для онбордингу, і для ручної зміни */}
      {showOnboarding && (
        <div
          style={{
            width: '92%',
            maxWidth: '900px',
            margin: '0 auto 2.5rem',
            background: 'linear-gradient(135deg, rgba(212,162,59,0.1) 0%, rgba(244,208,63,0.05) 100%)',
            border: '1px solid rgba(212,162,59,0.3)',
            borderRadius: '16px',
            padding: '1.8rem 2rem',
            boxSizing: 'border-box',
          }}
        >
          <p className="welcome-subtitle" style={{ margin: 0, textAlign: 'center' }}>
            <span className="welcome-emoji">🎯</span> Розкажи, що тобі цікаво
          </p>
          <p style={{ margin: '0.6rem 0 1.3rem', color: '#c9a96f', fontSize: '0.95rem', textAlign: 'center' }}>
            Обери до 5 жанрів — це допоможе одразу підібрати книги під твій смак
          </p>

          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <button
              onClick={clearSelection}
              disabled={selectedGenres.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.4rem 1rem',
                background: selectedGenres.length === 0 ? 'rgba(112,84,68,0.08)' : 'rgba(112,84,68,0.2)',
                border: `1px solid rgba(112,84,68,${selectedGenres.length === 0 ? 0.2 : 0.4})`,
                borderRadius: '16px',
                color: selectedGenres.length === 0 ? '#6b5645' : '#caa98a',
                fontSize: '0.85rem',
                fontFamily: 'Merriweather, serif',
                fontWeight: 500,
                cursor: selectedGenres.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedGenres.length === 0) return;
                e.currentTarget.style.background = 'rgba(112,84,68,0.35)';
                e.currentTarget.style.color = '#e0c9a6';
              }}
              onMouseLeave={(e) => {
                if (selectedGenres.length === 0) return;
                e.currentTarget.style.background = 'rgba(112,84,68,0.2)';
                e.currentTarget.style.color = '#caa98a';
              }}
            >
              ✕ Очистити вибір
            </button>
          </div>

          {availableGenres.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#a07e65' }}>⏳ Завантаження жанрів...</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', justifyContent: 'center', marginBottom: '1.6rem' }}>
              {availableGenres.map(genre => {
                const isSelected = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.55rem 1.2rem',
                      borderRadius: '24px',
                      border: isSelected ? '1.5px solid #d4a23b' : '1px solid rgba(202,169,138,0.3)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(212,162,59,0.28) 0%, rgba(244,208,63,0.16) 100%)'
                        : 'rgba(42,30,26,0.6)',
                      color: isSelected ? '#f8d9a6' : '#c9a96f',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.92rem',
                      fontFamily: 'Merriweather, serif',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 12px rgba(212,162,59,0.25)' : 'none',
                      transition: 'background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease',
                    }}
                  >
                    <span style={{ width: '12px', display: 'inline-block', textAlign: 'center', color: '#d4a23b', opacity: isSelected ? 1 : 0 }}>
                      ✓
                    </span>
                    <span>{genre}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={saveGenresAndRefresh}
              disabled={savingGenres}
              style={{
                padding: '0.75rem 1.7rem',
                background: 'linear-gradient(135deg, #705444 0%, #8b6b57 100%)',
                color: '#f8d9a6',
                border: '1px solid rgba(212,162,59,0.4)',
                borderRadius: '12px',
                fontWeight: 700,
                fontFamily: 'Merriweather, serif',
                cursor: savingGenres ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                transition: 'all 0.25s ease',
              }}
            >
              {savingGenres ? '⏳ Зберігаємо...' : `Зберегти (${selectedGenres.length}/5)`}
            </button>
            <button
              onClick={() => {
                setGenrePanelOpen(false);
                setDismissedThisVisit(true);
              }}
              style={{
                padding: '0.75rem 1.7rem',
                background: 'rgba(112,84,68,0.15)',
                color: '#e0c9a6',
                border: '1px solid rgba(112,84,68,0.5)',
                borderRadius: '12px',
                fontWeight: 600,
                fontFamily: 'Merriweather, serif',
                cursor: 'pointer',
                fontSize: '0.95rem',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(112,84,68,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(112,84,68,0.15)'; }}
            >
              {genrePanelOpen && !needsOnboarding ? 'Скасувати' : 'Пропустити'}
            </button>
          </div>
        </div>
      )}

      {/* Пояснення принципу роботи */}
      {!showOnboarding && (
        <div
          style={{
            width: '92%',
            maxWidth: '900px',
            margin: '0 auto 2.5rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            padding: '1.5rem 2rem',
            boxSizing: 'border-box',
          }}
        >
          {loading ? null : personalized ? (
            <>
              <p style={{ margin: 0, color: '#f8d9a6', fontWeight: 600, fontSize: '1.05rem' }}>
                🧠 Як це працює
              </p>
              <p style={{ margin: '0.6rem 0 0', color: '#c9a96f', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Система поєднує три сигнали: схожість за <strong style={{ color: '#e8caa0' }}>жанром і автором</strong>{' '}
                з книгами, які ти оцінив чи додав в обране, твої власноруч обрані{' '}
                <strong style={{ color: '#e8caa0' }}>жанри інтересів</strong>, а також{' '}
                <strong style={{ color: '#e8caa0' }}>оцінки інших читачів</strong> — книги,
                які високо оцінила спільнота, отримують додаткову перевагу.
              </p>
            </>
          ) : usingGenrePrefs ? (
            <>
              <p style={{ margin: 0, color: '#f8d9a6', fontWeight: 600, fontSize: '1.05rem' }}>
                🎯 Підбір за обраними жанрами
              </p>
              <p style={{ margin: '0.6rem 0 0', color: '#c9a96f', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Поки що в тебе немає обраних книг чи оцінок, тож ми показуємо книги
                за жанрами, які ти вибрав, віддаючи перевагу тим, що вже високо
                оцінили інші читачі. Постав оцінку книзі або додай її в обране —
                і рекомендації стануть персональнішими: ми почнемо враховувати
                ще й автора та жанр саме цих книг.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: '#c9a96f', lineHeight: 1.6, fontSize: '0.95rem', textAlign: 'center' }}>
              👥 Показуємо книги, які найвище оцінили інші читачі
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: '#caa98a', fontSize: '1.2rem' }}>⏳ Підбираємо книги...</p>
      ) : books.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#caa98a', fontSize: '1.2rem', marginBottom: '1rem' }}>
            📭 Поки що немає книг для рекомендацій
          </p>
          <Link href="/" className="nav-btn">📚 Переглянути каталог</Link>
        </div>
      ) : (
        <section className="book-grid">
          {books.map(book => (
            <div key={book._id} className="book-card" style={{ position: 'relative' }}>
              {book.isPremium && (
                <div
                  style={{
                    position: 'absolute', top: '10px', left: '10px',
                    background: 'linear-gradient(135deg, #d4a23b 0%, #f4d03f 100%)',
                    color: '#1a1410', padding: '5px 12px', borderRadius: '20px',
                    fontSize: '0.8rem', fontWeight: 'bold', zIndex: 10,
                    boxShadow: '0 2px 8px rgba(212,162,59,0.5)',
                  }}
                >
                  ⭐ Premium
                </div>
              )}

              <button
                onClick={(e) => { e.preventDefault(); toggleFavorite(book._id); }}
                style={{
                  position: 'absolute', top: '10px', right: '10px',
                  width: '45px', height: '45px', borderRadius: '50%',
                  border: 'none', padding: 0,
                  background: favorites.includes(book._id)
                    ? 'linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%)'
                    : 'rgba(255,255,255,0.2)',
                  color: favorites.includes(book._id) ? '#fff' : '#caa98a',
                  fontSize: '1.5rem', cursor: 'pointer', transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                title={favorites.includes(book._id) ? 'Видалити з обраного' : 'Додати в обране'}
              >
                {favorites.includes(book._id) ? '❤️' : '🤍'}
              </button>
              <img
                src={book.coverUrl || '/no-cover.png'}
                alt={`Обкладинка ${book.title}`}
                style={{
                  width: '100%',
                  height: '480px',
                  borderRadius: '10px',
                  marginBottom: '15px',
                  objectFit: 'cover',
                  transition: 'transform 0.4s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                }}
              />

              <h2 style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: '#f8d9a6',
                marginBottom: '0.5rem',
                lineHeight: '1.3',
                textShadow: '0 0 5px rgba(248,217,166,0.3)',
              }}>
                {book.title}
              </h2>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                padding: '0.5rem 0',
                borderBottom: '1px solid rgba(112,84,68,0.3)',
              }}>
                <span style={{ color: '#caa98a', fontSize: '1rem', fontWeight: 500 }}>
                  ✍️ {book.author}
                </span>
                <span style={{ color: '#a07e65', fontSize: '0.9rem' }}>•</span>
                <span style={{ color: '#a07e65', fontSize: '0.95rem', fontStyle: 'italic' }}>
                  📅 {book.year}
                </span>
              </div>

              <div style={{
                display: 'inline-block',
                padding: '0.4rem 0.9rem',
                backgroundColor: 'rgba(112,84,68,0.25)',
                borderRadius: '20px',
                border: '1px solid rgba(112,84,68,0.4)',
                marginBottom: '0.75rem',
              }}>
                <p style={{
                  color: '#d8b991',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  🏷️ {book.genre}
                </p>
              </div>

              <p style={{
                color: '#b09378',
                fontSize: '0.95rem',
                lineHeight: '1.5',
                marginBottom: '0.5rem',
                fontStyle: 'italic',
                minHeight: '2.9rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {book.description?.slice(0, 80)}...
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Link href={`/books/${book._id}`} className="read-btn" style={cardBtnStyle}>
                  📖 Детальніше
                </Link>
                {canDownload(book) ? (
                  <button
                    onClick={() => downloadBook(book._id)}
                    className="read-btn"
                    style={cardBtnStyle}
                  >
                    📥 Завантажити
                  </button>
                ) : (
                  <Link
                    href="/premium"
                    className="read-btn"
                    style={{ ...cardBtnStyle, background: '#d4a23b' }}
                  >
                    ⭐ Premium
                  </Link>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}