'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import FavoriteTab from '@/components/FavoriteTab';
import FadeIn from '@/components/FadeIn';
import WebBackground from '@/components/WebBackground';
import RecommendedBooks from '@/components/RecommendedBooks';

type Book = {
  _id: string;
  title: string;
  author: string;
  genre: string;
  year: number;
  description: string;
  fileUrl: string;
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
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Значення, що реально йдуть у запит (з затримкою відносно того, що вводить користувач)
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedGenre, setDebouncedGenre] = useState('');
  const [debouncedYear, setDebouncedYear] = useState('');

  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumChecked, setPremiumChecked] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const booksPerPage = 6;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: чекаємо 400мс тиші після останнього натискання, перш ніж слати запит
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setDebouncedGenre(genreFilter);
      setDebouncedYear(yearFilter);
      setCurrentPage(1);
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchTerm, genreFilter, yearFilter]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage]);

  const loadUser = async () => {
    const token = localStorage.getItem('readgrid_token');
    if (!token) {
      setIsAuthorized(false);
      setUsername('');
      setRole('');
      setIsPremium(false);
      setPremiumChecked(true);
      setAuthChecked(true);
      return;
    }

    try {
      const decoded = decodeJWT(token);
      if (!decoded || decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('readgrid_token');
        setIsAuthorized(false);
        setUsername('');
        setRole('');
        setIsPremium(false);
      } else {
        setUsername(decoded.username);
        setRole(decoded.role);
        setIsAuthorized(true);
        fetchFavorites(token);
        await fetchUserPremiumStatus(decoded.userId, token);
      }
    } catch {
      setIsAuthorized(false);
      setUsername('');
      setRole('');
      setIsPremium(false);
    } finally {
      setAuthChecked(true);
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
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites.map((book: Book) => book._id));
      }
    } catch (error) {
      console.error('Fetch favorites error:', error);
    }
  };

  const toggleFavorite = async (bookId: string) => {
    const token = localStorage.getItem('readgrid_token');
    if (!token) return;

    const isFavorite = favorites.includes(bookId);

    try {
      if (isFavorite) {
        const res = await fetch(`/api/favorites?bookId=${bookId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setFavorites(prev => prev.filter(id => id !== bookId));
        }
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ bookId }),
        });
        if (res.ok) {
          setFavorites(prev => [...prev, bookId]);
        }
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (bookId: string) => {
    const token = localStorage.getItem('readgrid_token');
    if (!token) return;

    setDownloadingId(bookId);
    try {
      const res = await fetch(`/api/books/${bookId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Не вдалося отримати файл');
        return;
      }

      const link = document.createElement('a');
      link.href = data.fileUrl;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Помилка мережі');
    } finally {
      setDownloadingId(null);
    }
  };

  // Головна функція: запитує з сервера ТІЛЬКИ потрібну сторінку з урахуванням фільтрів
  const fetchBooks = useCallback(async () => {
    setBooksLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(booksPerPage));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (debouncedGenre) params.set('genre', debouncedGenre);
      if (debouncedYear) params.set('year', debouncedYear);

      const timestamp = new Date().getTime();
      params.set('t', String(timestamp));

      const res = await fetch(`/api/books?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();

      setBooks(data.books || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Fetch books error:', error);
      setBooks([]);
      setTotalPages(1);
    } finally {
      setBooksLoading(false);
    }
  }, [currentPage, debouncedSearch, debouncedGenre, debouncedYear]);

  useEffect(() => {
    loadUser();
  }, []);

  // Перезапитуємо книги щоразу, коли міняється сторінка або (з затримкою) фільтри
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    const handleStorage = () => loadUser();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('readgrid_token');
    setIsAuthorized(false);
    setUsername('');
    setRole('');
    setIsPremium(false);
    window.location.reload();
  };

  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <WebBackground />

      {authChecked && isAuthorized && (
        <FavoriteTab />
      )}

      {/* Фонові елементи */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '85px',
          height: '100%',
          backgroundImage: 'url("/side-left.png")',
          backgroundRepeat: 'repeat-y',
          backgroundSize: 'contain',
          opacity: 0.1,
          filter: 'blur(0.3px) brightness(1.1)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '85px',
          height: '100%',
          backgroundImage: 'url("/side-right.png")',
          backgroundRepeat: 'repeat-y',
          backgroundSize: 'contain',
          opacity: 0.1,
          filter: 'blur(0.3px) brightness(1.1)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Навігація */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: "1200px",
          marginBottom: "2rem",
          borderBottom: "1px solid #705444",
          paddingBottom: "1rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/logo.png"
            alt="ReadGrid logo"
            className="logo"
            style={{
              width: 85,
              height: 85,
              borderRadius: '50%',
              boxShadow: '0 0 12px rgba(255, 208, 163, 0.4)',
              border: '2px solid #caa98a',
              objectFit: 'cover',
              backgroundColor: '#2a1e1a',
              transition: 'transform 0.4s ease, box-shadow 0.4s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 208, 163, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(255, 208, 163, 0.4)';
            }}
          />
          <h1 style={{ fontSize: "1.8rem", color: "#f8d9a6" }}>ReadGrid 📚</h1>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {authChecked && (
            <FadeIn>
              {isAuthorized ? (
                <>
                  <Link href="/profile" className="nav-btn">👤 Профіль</Link>
                  <Link href="/recommendations" className="nav-btn" style={{ backgroundColor: "#4c8a52", color: "#fff" }}>
                    ✨ Рекомендації
                  </Link>
                  {premiumChecked && (
                    <>
                      {!isPremium && (
                        <Link href="/premium" className="nav-btn" style={{ backgroundColor: "#d4a23b", color: "#fff" }}>
                          ✨ Premium
                        </Link>
                      )}
                      {isPremium && (
                        <span style={{
                          padding: '8px 16px',
                          backgroundColor: 'rgba(212,162,59,0.2)',
                          borderRadius: '8px',
                          color: '#d4a23b',
                          fontSize: '0.9rem',
                          fontWeight: 'bold'
                        }}>
                          ⭐ Premium
                        </span>
                      )}
                    </>
                  )}
                  {(role === 'admin' || role === 'superadmin') && (
                    <Link
                      href="/admin"
                      className="nav-btn"
                      style={{
                        backgroundColor: role === 'superadmin' ? 'transparent' : "#c47f5f",
                        color: role === 'superadmin' ? '#ffd700' : "#fff8f2",
                        border: role === 'superadmin' ? '2px solid #ffd700' : 'none',
                        fontWeight: role === 'superadmin' ? '700' : '600',
                      }}
                    >
                      {role === 'superadmin' ? '👑 Super Admin' : '🛠️ Admin Panel'}
                    </Link>
                  )}
                  <button onClick={handleLogout} className="nav-btn delete">🚪 Вийти</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="nav-btn">🔑 Увійти</Link>
                  <Link href="/register" className="nav-btn">📝 Реєстрація</Link>
                </>
              )}
            </FadeIn>
          )}
        </div>
      </nav>

      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p className="welcome-title fade-in-left">
          Вітаємо у системі електронної бібліотеки! <span className="welcome-emoji">📖</span>
        </p>

        <div className="welcome-divider"></div>
        {username && (
          <p className="welcome-subtitle fade-in-right">
            <span className="welcome-emoji">👋</span> Приємно бачити, {username}!
          </p>
        )}
      </div>

      {/* Фільтри — тепер відправляються на сервер із затримкою (debounce) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          width: "100%",
          maxWidth: "1000px",
          marginBottom: "2rem",
        }}
      >
        <input
          type="text"
          placeholder="🔍 Пошук за назвою або автором..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <input
          type="text"
          placeholder="Жанр (наприклад: фентезі)"
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
        />
        <input
          type="number"
          placeholder="Рік видання"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          min={1500}
          max={new Date().getFullYear()}
        />
      </div>

      {/* Книги */}
      <section className="book-grid">
        {booksLoading ? (
          <p className="subtitle">⏳ Завантаження...</p>
        ) : books.length === 0 ? (
          <p className="subtitle">📚 Нічого не знайдено</p>
        ) : (
          books.map(book => (
            <div key={book._id} className="book-card" style={{ position: 'relative' }}>
              {book.isPremium && (
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'linear-gradient(135deg, #d4a23b 0%, #f4d03f 100%)',
                    color: '#1a1410',
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    zIndex: 10,
                    boxShadow: '0 2px 8px rgba(212,162,59,0.5)',
                  }}
                >
                  ⭐ Premium
                </div>
              )}

              {isAuthorized && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(book._id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    border: 'none',
                    background: favorites.includes(book._id)
                      ? 'linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%)'
                      : 'rgba(255,255,255,0.2)',
                    color: favorites.includes(book._id) ? '#fff' : '#caa98a',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title={favorites.includes(book._id) ? 'Видалити з обраного' : 'Додати в обране'}
                >
                  {favorites.includes(book._id) ? '❤️' : '🤍'}
                </button>
              )}

              <img
                src={book.coverUrl || "/no-cover.png"}
                alt={`Обкладинка ${book.title}`}
                style={{
                  width: "100%",
                  height: "480px",
                  borderRadius: "10px",
                  marginBottom: "15px",
                  objectFit: "cover",
                  transition: "transform 0.4s ease",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.02)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
                }}
              />

              <h2 style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                color: "#f8d9a6",
                marginBottom: "0.5rem",
                lineHeight: "1.3",
                textShadow: "0 0 5px rgba(248,217,166,0.3)",
              }}>
                {book.title}
              </h2>

              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
                padding: "0.5rem 0",
                borderBottom: "1px solid rgba(112,84,68,0.3)",
              }}>
                <span style={{ color: "#caa98a", fontSize: "1rem", fontWeight: 500 }}>
                  ✍️ {book.author}
                </span>
                <span style={{ color: "#a07e65", fontSize: "0.9rem" }}>•</span>
                <span style={{ color: "#a07e65", fontSize: "0.95rem", fontStyle: "italic" }}>
                  📅 {book.year}
                </span>
              </div>

              <div style={{
                display: "inline-block",
                padding: "0.4rem 0.9rem",
                backgroundColor: "rgba(112,84,68,0.25)",
                borderRadius: "20px",
                border: "1px solid rgba(112,84,68,0.4)",
                marginBottom: "0.75rem",
              }}>
                <p style={{
                  color: "#d8b991",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}>
                  🏷️ {book.genre}
                </p>
              </div>

              <p style={{
                color: "#b09378",
                fontSize: "0.95rem",
                lineHeight: "1.5",
                marginBottom: "0.5rem",
                fontStyle: "italic",
                minHeight: "2.9rem",         
                display: "-webkit-box",
                WebkitLineClamp: 2,         
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {book.description?.slice(0, 80)}...
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <Link
                  href={`/books/${book._id}`}
                  className="read-btn"
                  style={{ textAlign: 'center' }}
                >
                  📖 Детальніше
                </Link>
                {isAuthorized ? (
                  book.isPremium && !isPremium ? (
                    <Link
                      href="/premium"
                      className="read-btn"
                      style={{
                        background: '#d4a23b',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ⭐ Premium
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleDownload(book._id)}
                      disabled={downloadingId === book._id}
                      className="read-btn"
                      style={{
                        border: 'none',
                        cursor: downloadingId === book._id ? 'not-allowed' : 'pointer',
                        opacity: downloadingId === book._id ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {downloadingId === book._id ? '⏳ Завантаж...' : '📥 Завантажити'}
                    </button>
                  )
                ) : (
                  <Link
                    href="/login"
                    className="read-btn"
                    style={{
                      backgroundColor: 'rgba(112,84,68,0.35)',
                      color: '#e0c9a6',
                      border: '1px solid rgba(202,169,138,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      textAlign: 'center',
                    }}
                  >
                    🔒 Увійдіть
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Пагінація — номери сторінок тепер приходять із сервера (totalPages) */}
      {totalPages > 1 && (
        <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
          {[...Array(totalPages)].map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index + 1)}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #705444",
                background: currentPage === index + 1 ? "#705444" : "transparent",
                color: currentPage === index + 1 ? "#f8d9a6" : "#caa98a",
                cursor: "pointer",
                transition: "0.3s",
              }}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      <footer
        style={{
          marginTop: "4rem",
          textAlign: "center",
          color: "#a07e65",
          borderTop: "1px solid transparent",
          borderImage:
            "linear-gradient(90deg, transparent, #705444 20%, #caa98a 50%, #705444 80%, transparent) 1",
          paddingTop: "1rem",
          width: "70%",
          maxWidth: "none",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-1px",
            left: "15%",
            width: "70%",
            height: "1px",
            background: "#caa98a",
            opacity: 0.25,
            filter: "blur(4px)",
            pointerEvents: "none",
          }}
        />

        <p
          style={{
            margin: 0,
            transition: "all 0.3s ease",
            cursor: "default",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#caa98a";
            e.currentTarget.style.textShadow =
              "0 0 10px rgba(202,169,138,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#a07e65";
            e.currentTarget.style.textShadow = "none";
          }}
        >
          © 2025 ReadGrid — Інтелектуальна система електронної бібліотеки
        </p>
      </footer>
    </div>
  );
}