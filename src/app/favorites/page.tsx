'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WebBackground from '@/components/WebBackground';
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
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

export default function FavoritesPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [username, setUsername] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [premiumChecked, setPremiumChecked] = useState(false);
  const [role, setRole] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const booksPerPage = 6;

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
        fetchFavorites(token);
        fetchUserPremiumStatus(decoded.userId, token);
      }
    } catch {
      setIsAuthorized(false);
      setLoading(false);
    }
  }, []);

  const fetchFavorites = async (token: string) => {
    try {
      const res = await fetch('/api/favorites', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        setBooks(data.favorites || []);
        setFilteredBooks(data.favorites || []);
      }
    } catch (error) {
      console.error('Fetch favorites error:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromFavorites = async (bookId: string) => {
    const token = localStorage.getItem('readgrid_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/favorites?bookId=${bookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setBooks(prev => prev.filter(b => b._id !== bookId));
        setFilteredBooks(prev => prev.filter(b => b._id !== bookId));
      }
    } catch (error) {
      console.error('Remove from favorites error:', error);
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

  const canDownload = (book: Book) =>
    !book.isPremium || isPremium || role === 'admin' || role === 'superadmin' || !premiumChecked;

  useEffect(() => {
    const filtered = books.filter(book => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGenre = genreFilter
        ? book.genre.toLowerCase().includes(genreFilter.toLowerCase())
        : true;

      const matchesYear = yearFilter
        ? book.year.toString() === yearFilter
        : true;

      return matchesSearch && matchesGenre && matchesYear;
    });

    setFilteredBooks(filtered);
    setCurrentPage(1);
  }, [searchTerm, genreFilter, yearFilter, books]);

  const cardBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '0.35rem 0.7rem',
    fontSize: '0.85rem',
    borderRadius: '6px',
    fontFamily: 'inherit',
    fontWeight: 'normal',
    letterSpacing: 'normal',
    cursor: 'pointer',
  };

  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  const startIndex = (currentPage - 1) * booksPerPage;
  const currentBooks = filteredBooks.slice(startIndex, startIndex + booksPerPage);

  if (!isAuthorized) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '4rem' }}>
        <h1 style={{ color: '#f8d9a6', fontSize: '2rem', marginBottom: '1rem' }}>🔒 Доступ заборонено</h1>
        <p style={{ color: '#caa98a', fontSize: '1.2rem', marginBottom: '2rem' }}>
          Увійдіть, щоб переглянути обране
        </p>
        <Link href="/login" className="nav-btn">🔑 Увійти</Link>
      </div>
    );
  }

  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <WebBackground />

      {/* Бокові зображення */}
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

      {/* Назад */}
      <Link href="/" className="nav-btn" style={{ marginBottom: '2rem', display: 'inline-block' }}>
        ⬅️ На головну
      </Link>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <p className="welcome-title fade-in-left">
          <span className="welcome-emoji">⭐</span> Моє обране
        </p>
        <div className="welcome-divider"></div>
        <p className="welcome-subtitle fade-in-right">
          <span className="welcome-emoji">👋</span> Привіт, {username}! Тут зібрані твої улюблені книги <span className="welcome-emoji">📚</span>
        </p>
      </div>

      {/* Пошук та фільтри */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        width: '100%',
        maxWidth: '1000px',
        marginBottom: '2rem',
      }}>
        <input
          type="text"
          placeholder="🔍 Пошук за назвою або автором..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <input
          type="text"
          placeholder="Жанр"
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

      {/* Список книг */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#caa98a', fontSize: '1.2rem' }}>⏳ Завантаження...</p>
      ) : currentBooks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#caa98a', fontSize: '1.2rem', marginBottom: '1rem' }}>
            💔 Ваше обране порожнє
          </p>
          <Link href="/" className="nav-btn">📚 Додати книги</Link>
        </div>
      ) : (
        <section className="book-grid">
          {currentBooks.map(book => (
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
                marginBottom: '1rem',
                fontStyle: 'italic',
              }}>
                {book.description?.slice(0, 80)}...
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '0.8rem' }}>
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
                    style={{ ...cardBtnStyle, background: '#d4a23b', whiteSpace: 'nowrap' }}
                  >
                    ⭐ Premium
                  </Link>
                )}

                <button
                  onClick={() => removeFromFavorites(book._id)}
                  className="read-btn delete"
                  style={{ ...cardBtnStyle, backgroundColor: '#c45f5f' }}
                >
                  💔 Видалити
                </button>
              </div>

            </div>
          ))}
        </section>
      )}

      {/* Пагінація */}
      {totalPages > 1 && (
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
          {[...Array(totalPages)].map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index + 1)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #705444',
                background: currentPage === index + 1 ? '#705444' : 'transparent',
                color: currentPage === index + 1 ? '#f8d9a6' : '#caa98a',
                cursor: 'pointer',
                transition: '0.3s',
              }}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}