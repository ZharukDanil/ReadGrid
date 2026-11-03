'use client';
import { useState } from 'react';
import Link from 'next/link';
import WebBackground from '@/components/WebBackground';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.9rem 1.2rem',
  background: 'rgba(46, 38, 33, 0.6)',
  border: '2px solid rgba(112, 84, 68, 0.3)',
  borderRadius: '12px',
  color: '#f8d9a6',
  fontSize: '1rem',
  outline: 'none',
  transition: 'all 0.3s ease',
  boxSizing: 'border-box',
};

const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'rgba(248, 217, 166, 0.6)';
  e.currentTarget.style.background = 'rgba(46, 38, 33, 0.8)';
};

const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'rgba(112, 84, 68, 0.3)';
  e.currentTarget.style.background = 'rgba(46, 38, 33, 0.6)';
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Введіть коректний email');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDone(true);
      else setError(data.message || 'Не вдалося надіслати запит');
    } catch {
      setError('Помилка мережі');
    } finally {
      setLoading(false);
    }
  };

  const secondaryLinkStyle: React.CSSProperties = {
    width: '100%',
    padding: '1rem',
    background: 'rgba(112, 84, 68, 0.2)',
    border: '2px solid rgba(112, 84, 68, 0.4)',
    color: '#f8d9a6',
    borderRadius: '12px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '1.05rem',
    transition: 'all 0.3s ease',
    display: 'block',
    textAlign: 'center',
    letterSpacing: '0.5px',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="page"
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100vh',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <WebBackground />

      {/* Бокові зображення */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '85px', height: '100%',
          backgroundImage: 'url("/side-left.png")', backgroundRepeat: 'repeat-y',
          backgroundSize: 'contain', opacity: 0.1, filter: 'blur(0.3px) brightness(1.1)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute', top: 0, right: 0, width: '85px', height: '100%',
          backgroundImage: 'url("/side-right.png")', backgroundRepeat: 'repeat-y',
          backgroundSize: 'contain', opacity: 0.1, filter: 'blur(0.3px) brightness(1.1)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* Картка */}
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          background: 'rgba(27, 20, 17, 0.85)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(112, 84, 68, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 100px rgba(112, 84, 68, 0.1)',
          padding: '3rem 2.5rem',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
        }}
      >
        {/* Логотип і заголовок */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: 'rgba(112, 84, 68, 0.2)',
              border: '2px solid rgba(248, 217, 166, 0.3)',
              marginBottom: '1.5rem',
              boxShadow: '0 0 30px rgba(248, 217, 166, 0.2)',
            }}
          >
            <img
              src="/logo.png"
              alt="ReadGrid"
              style={{ width: '70px', height: '70px', borderRadius: '50%' }}
            />
          </div>

          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#f8d9a6',
              marginBottom: '0.5rem',
              textShadow: '0 0 20px rgba(248, 217, 166, 0.3)',
              letterSpacing: '1px',
            }}
          >
            ReadGrid
          </h1>
          <p style={{ color: '#caa98a', fontSize: '1rem', fontWeight: 400, margin: 0 }}>
            🔑 Відновлення пароля
          </p>
        </div>

        {done ? (
          <>
            <div
              style={{
                padding: '1rem 1.2rem',
                borderRadius: '10px',
                background: 'rgba(168, 230, 161, 0.1)',
                border: '1px solid rgba(168, 230, 161, 0.3)',
                color: '#a8e6a1',
                textAlign: 'center',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              ✅ Якщо такий email зареєстровано, ми надіслали на нього лист з посиланням для зміни
              пароля. Посилання дійсне 1 годину.
            </div>

            <div style={{ marginTop: '1.75rem' }}>
              <Link
                href="/login"
                style={secondaryLinkStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(112, 84, 68, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(112, 84, 68, 0.6)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(112, 84, 68, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(112, 84, 68, 0.4)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                ⬅️ До входу
              </Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p
              style={{
                color: '#c9a96f',
                fontSize: '0.95rem',
                textAlign: 'center',
                margin: '0 0 1.5rem',
                lineHeight: 1.5,
              }}
            >
              Введіть email вашого акаунта — ми надішлемо посилання для створення нового пароля.
            </p>

            <label
              style={{
                display: 'block',
                color: '#d8c3a5',
                fontSize: '0.9rem',
                fontWeight: 500,
                marginBottom: '0.5rem',
                marginLeft: '0.25rem',
              }}
            >
              📧 Email
            </label>
            <input
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={inputStyle}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
            />

            {error && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.9rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(255, 99, 99, 0.1)',
                  border: '1px solid rgba(255, 99, 99, 0.3)',
                  color: '#ff9999',
                  textAlign: 'center',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.75rem' }}>
              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background:
                    loading || !email
                      ? 'rgba(112, 84, 68, 0.4)'
                      : 'linear-gradient(135deg, #705444 0%, #8b6b57 100%)',
                  color: '#f8d9a6',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  cursor: loading || !email ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: loading || !email ? 'none' : '0 4px 15px rgba(112, 84, 68, 0.4)',
                  letterSpacing: '0.5px',
                  opacity: !email && !loading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading && email) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(112, 84, 68, 0.6)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && email) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(112, 84, 68, 0.4)';
                  }
                }}
              >
                {loading ? '⏳ Надсилаємо...' : '📨 Надіслати лист'}
              </button>

              <Link
                href="/login"
                style={secondaryLinkStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(112, 84, 68, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(112, 84, 68, 0.6)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(112, 84, 68, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(112, 84, 68, 0.4)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                ⬅️ Скасувати
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}