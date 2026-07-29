'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Book = {
  _id: string;
  title: string;
  author: string;
  genre: string;
  year: number;
  coverUrl: string;
  isPremium?: boolean;
};

export default function RecommendedBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('readgrid_token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/recommendations', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(res => res.json())
      .then(data => setBooks(data.books || []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || books.length === 0) return null;

  return (
    <section style={{ width: '100%', maxWidth: '1200px', margin: '0 auto 2.5rem' }}>
      <h2
        style={{
          textAlign: 'center',
          color: '#f8d9a6',
          fontSize: '1.5rem',
          marginBottom: '1.2rem',
          fontFamily: 'Merriweather, serif',
        }}
      >
        ✨ Рекомендовано для вас
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.2rem',
        }}
      >
        {books.map(book => (
          <Link
            key={book._id}
            href={`/books/${book._id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'transform 0.3s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <img
                src={book.coverUrl || '/no-cover.png'}
                alt={book.title}
                style={{ width: '100%', height: '220px', objectFit: 'cover' }}
              />
              <div style={{ padding: '0.7rem' }}>
                <p style={{ margin: 0, color: '#f8d9a6', fontWeight: 600, fontSize: '0.9rem' }}>
                  {book.title}
                </p>
                <p style={{ margin: '2px 0 0', color: '#a07e65', fontSize: '0.8rem' }}>
                  {book.author}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}