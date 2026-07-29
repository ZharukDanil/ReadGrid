'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WebBackground from '@/components/WebBackground';

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
  } catch {
    return null;
  }
}

export default function RecommendationsPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [personalized, setPersonalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [username, setUsername] = useState('');

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
        setIsAuthorized(true);
        fetchRecommendations(token);
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
      }
    } catch (error) {
      console.error('Fetch recommendations error:', error);
    } finally {
      setLoading(false);
    }
  };

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

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <p className="welcome-title fade-in-left">
          <span className="welcome-emoji">✨</span> Рекомендовано для вас
        </p>
        <div className="welcome-divider"></div>
        <p className="welcome-subtitle fade-in-right">
          <span className="welcome-emoji">👋</span> {username}, ось книги, підібрані спеціально для тебе
        </p>
      </div>

      {/* Пояснення, як працює система рекомендацій */}
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
              Система аналізує жанри й авторів книг, які ти додав в обране або оцінив, і шукає схожі
              за змістом видання (<strong style={{ color: '#e8caa0' }}>контентна фільтрація</strong>).
              Водночас вона знаходить читачів зі схожими смаками і враховує, що подобається їм
              (<strong style={{ color: '#e8caa0' }}>колаборативна фільтрація</strong>). Список нижче —
              результат поєднання обох підходів.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: 0, color: '#f8d9a6', fontWeight: 600, fontSize: '1.05rem' }}>
              📖 Поки що показуємо найновіші книги
            </p>
            <p style={{ margin: '0.6rem 0 0', color: '#c9a96f', lineHeight: 1.6, fontSize: '0.95rem' }}>
              У тебе ще немає обраних книг або оцінок — системі нема на чому будувати персональні
              рекомендації. Додай кілька книг в обране або постав оцінку в коментарях, і рекомендації
              стануть персональними.
            </p>
          </>
        )}
      </div>

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
            <div key={book._id} className="book-card">
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

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1rem' }}>
                <Link href={`/books/${book._id}`} className="read-btn">📖 Детальніше</Link>
                <a href={book.fileUrl} target="_blank" rel="noopener noreferrer" className="read-btn">📥 Завантажити</a>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}