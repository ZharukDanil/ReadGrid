'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#d8c3a5',
  fontSize: '0.9rem',
  fontWeight: 500,
  marginBottom: '0.5rem',
  marginLeft: '0.25rem',
};

const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'rgba(248, 217, 166, 0.6)';
  e.currentTarget.style.background = 'rgba(46, 38, 33, 0.8)';
};

const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'rgba(112, 84, 68, 0.3)';
  e.currentTarget.style.background = 'rgba(46, 38, 33, 0.6)';
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t || '');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Пароль має бути мінімум 6 символів');
      return;
    }
    if (password !== confirm) {
      setError('Паролі не збігаються');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.message || 'Не вдалося змінити пароль');
      }
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

  if (token === null) return null;

  const canSubmit = !loading && !!password && !!confirm;

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
            🔒 Новий пароль
          </p>
        </div>

        {token === '' ? (
          <>
            <div
              style={{
                padding: '1rem 1.2rem',
                borderRadius: '10px',
                background: 'rgba(255, 99, 99, 0.1)',
                border: '1px solid rgba(255, 99, 99, 0.3)',
                color: '#ff9999',
                textAlign: 'center',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              ⚠️ Посилання недійсне. Запросіть відновлення пароля ще раз.
            </div>
            <div style={{ marginTop: '1.75rem' }}>
              <Link
                href="/forgot-password"
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
                🔁 Запросити знову
              </Link>
            </div>
          </>
        ) : done ? (
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
            ✅ Пароль успішно змінено! Зараз ви будете перенаправлені на сторінку входу...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>🔒 Новий пароль</label>
                <input
                  type="password"
                  placeholder="Мінімум 6 символів"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>

              <div>
                <label style={labelStyle}>🔒 Повторіть пароль</label>
                <input
                  type="password"
                  placeholder="Введіть пароль ще раз"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>
            </div>

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

            <div style={{ marginTop: '1.75rem' }}>
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: canSubmit
                    ? 'linear-gradient(135deg, #705444 0%, #8b6b57 100%)'
                    : 'rgba(112, 84, 68, 0.4)',
                  color: '#f8d9a6',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  boxShadow: canSubmit ? '0 4px 15px rgba(112, 84, 68, 0.4)' : 'none',
                  letterSpacing: '0.5px',
                  opacity: !canSubmit && !loading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (canSubmit) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(112, 84, 68, 0.6)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (canSubmit) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(112, 84, 68, 0.4)';
                  }
                }}
              >
                {loading ? '⏳ Зберігаємо...' : '💾 Зберегти пароль'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}