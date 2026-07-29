'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WebBackground from '@/components/WebBackground';

interface DecodedToken {
  userId?: string;
  id?: string;
  username?: string;
  role?: string;
  exp?: number;
}

interface UserComment {
  _id: string;
  content: string;
  rating?: number;
  createdAt: string;
  bookId: {
    _id: string;
    title: string;
    coverUrl?: string;
  };
}

interface UserData {
  _id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  lastLogin?: string;
  updatedAt?: string;
  isPremium?: boolean;
  premiumUntil?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [originalData, setOriginalData] = useState<{ username: string; email: string } | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [role, setRole] = useState('user');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'comments'>('profile');
  const [comments, setComments] = useState<UserComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);

  function parseJwtPayload(token: string): DecodedToken | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const json = atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('readgrid_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const payload = parseJwtPayload(token);
    if (!payload) {
      localStorage.removeItem('readgrid_token');
      router.push('/login');
      return;
    }

    const uid = (payload.userId || payload.id) as string | undefined;
    if (!uid) {
      localStorage.removeItem('readgrid_token');
      router.push('/login');
      return;
    }

    setUserId(uid);
    fetchUser(uid, token);
    fetchComments(uid, token);
    fetchFavoritesCount(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUser = async (id: string, token: string) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Fetch user failed, server response:', text);
        throw new Error('Не вдалось завантажити профіль');
      }
      const data = await res.json();
      setUserData(data);
      setUsername(data.username || '');
      setEmail(data.email || '');
      setRole(data.role || 'user');
      setIsPremium(data.isPremium || false);
      setPremiumUntil(data.premiumUntil || null);
      setOriginalData({ username: data.username || '', email: data.email || '' });
    } catch (err: any) {
      console.error('fetchUser error:', err);
      setMessage('❌ Помилка завантаження даних користувача');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (id: string, token: string) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/users/${id}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load comments');

      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const fetchFavoritesCount = async (token: string) => {
    try {
      const res = await fetch('/api/favorites', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setFavoritesCount((data.favorites || []).length);
      }
    } catch (err) {
      console.error('Fetch favorites count error:', err);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!username || username.length < 3) {
      setMessage('Ім\'я має бути принаймні 3 символи');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Невірний формат email');
      return;
    }
    if (password && password.length < 6) {
      setMessage('Пароль має бути мінімум 6 символів');
      return;
    }

    setLoading(true);
    setMessage('⏳ Збереження...');
    try {
      const token = localStorage.getItem('readgrid_token');
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, email, password }),
      });

      const bodyText = await res.text();
      let data: any;
      try {
        data = JSON.parse(bodyText);
      } catch {
        console.error('Non-JSON response from /api/users/:', bodyText);
        throw new Error('Сервер повернув неочікувану відповідь');
      }

      if (!res.ok) {
        throw new Error(data.message || 'Помилка при оновленні профілю');
      }

      if (data.token) {
        localStorage.setItem('readgrid_token', data.token);
        window.dispatchEvent(new Event('storage'));
      }

      setMessage('✅ Профіль успішно оновлено!');
      setPassword('');
      setOriginalData({ username, email });

      if (userData) {
        setUserData({ ...userData, username, email });
      }
    } catch (err: any) {
      console.error('handleSave error:', err);
      setMessage(err.message || '❌ Помилка при оновленні профілю');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (!originalData) return;
    setUsername(originalData.username);
    setEmail(originalData.email);
    setPassword('');
    setMessage('↩ Зміни скинуто');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цей коментар?')) return;

    try {
      const token = localStorage.getItem('readgrid_token');
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete');

      setComments(comments.filter(c => c._id !== commentId));
      setMessage('✅ Коментар видалено');
    } catch (err) {
      setMessage('❌ Помилка при видаленні коментаря');
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Ви впевнені, що хочете скасувати Premium підписку? Ви втратите доступ до всіх преміум книг.')) {
      return;
    }

    setCancelling(true);
    setMessage('⏳ Скасування підписки...');

    const token = localStorage.getItem('readgrid_token');

    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('✅ Підписку успішно скасовано');
        setIsPremium(false);
        setPremiumUntil(null);

        if (userData) {
          setUserData({ ...userData, isPremium: false, premiumUntil: undefined });
        }

        window.dispatchEvent(new Event('storage'));
      } else {
        setMessage(`❌ ${data.message || 'Помилка скасування підписки'}`);
      }
    } catch (error) {
      setMessage('❌ Помилка з\'єднання з сервером');
    } finally {
      setCancelling(false);
    }
  };

  function formatDate(date: string | Date | undefined | null) {
    if (!date) return 'Немає даних';
    const d = new Date(date);
    return isNaN(d.getTime()) ? 'Немає даних' : d.toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateShort(date: string | Date | undefined | null) {
    if (!date) return '—';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const getAverageRating = () => {
    const rated = comments.filter(c => c.rating);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((acc, c) => acc + (c.rating || 0), 0);
    return (sum / rated.length).toFixed(1);
  };

  const getPremiumDaysLeft = () => {
    if (!premiumUntil) return 0;
    const diff = new Date(premiumUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getDaysSinceJoined = () => {
    if (!userData?.createdAt) return 0;
    const diff = Date.now() - new Date(userData.createdAt).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const getLastComment = () => {
    if (comments.length === 0) return null;
    return [...comments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  };

  if (!userId || !userData) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1410 0%, #2a1e1a 50%, #1a1410 100%)',
      }}>
        <p style={{ color: '#f8d9a6', fontSize: '1.2rem' }}>⏳ Завантаження...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <WebBackground />
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

      {/* === Шапка === */}
      <header className="header" style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingBottom: 0, marginBottom: 0 }}>
        <img src="/logo.png" alt="ReadGrid logo" className="logo" style={{ width: 85, height: 85, margin: '0 auto 0.8rem' }} />
        <p className="welcome-title fade-in-left" style={{ marginBottom: 0 }}>ReadGrid</p>
        <div className="welcome-divider small" style={{ margin: '10px auto' }}></div>
        <p className="welcome-subtitle fade-in-right" style={{ margin: 0 }}>Мій профіль</p>
      </header>

      {/* === Перемикач вкладок === */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.9rem', position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '10px 22px',
            backgroundColor: activeTab === 'profile' ? '#4c8a52' : '#705444',
            color: '#f4e9d8', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontSize: '16px', transition: '0.3s',
          }}
        >
          👤 Профіль
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          style={{
            padding: '10px 22px',
            backgroundColor: activeTab === 'comments' ? '#4c8a52' : '#705444',
            color: '#f4e9d8', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontSize: '16px', transition: '0.3s',
          }}
        >
          💬 Коментарі
        </button>
      </div>

      {/* === Вкладка ПРОФІЛЬ === */}
      {activeTab === 'profile' && (
        <div style={{ width: '92%', maxWidth: '960px', margin: '0 auto', boxSizing: 'border-box' }}>

          {/* --- Верхній ряд: аватар-картка + форма-картка --- */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
              width: '100%',
              marginTop: '2rem',
              position: 'relative',
              zIndex: 1,
              alignItems: 'stretch',
              boxSizing: 'border-box',
            }}
          >
            {/* Ліва картка: аватар + статистика */}
            <div
              style={{
                flex: '1 1 300px',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '18px',
                padding: '2rem 1.5rem',
                boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #6b4e38 0%, #4a3527 55%, #35261b 100%)',
                  border: role === 'admin' ? '2.5px solid #d4a23b' : '2.5px solid #a3805f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.1rem',
                  fontWeight: 700,
                  color: '#fdeecb',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  boxShadow: role === 'admin'
                    ? '0 0 18px rgba(212,162,59,0.5), 0 6px 14px rgba(0,0,0,0.5), inset 0 2px 6px rgba(0,0,0,0.3)'
                    : '0 6px 14px rgba(0,0,0,0.5), inset 0 2px 6px rgba(0,0,0,0.3)',
                  marginBottom: '0.9rem',
                }}
              >
                {username ? username[0].toUpperCase() : '?'}
              </div>

              <h2 style={{ margin: 0, color: '#f8d9a6', fontSize: '1.4rem' }}>{username}</h2>

              <span
                style={{
                  marginTop: '0.5rem',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: role === 'admin' ? '#d4a23b' : '#caa98a',
                  background: role === 'admin' ? 'rgba(212,162,59,0.15)' : 'rgba(112,84,68,0.2)',
                  border: role === 'admin' ? '1px solid rgba(212,162,59,0.35)' : '1px solid rgba(112,84,68,0.4)',
                }}
              >
                {role === 'admin' ? '⚡ Адмін' : '👤 Користувач'}
              </span>

              <div
                style={{
                  width: '100%',
                  height: '1px',
                  background: 'rgba(255,255,255,0.15)',
                  margin: '1.4rem 0',
                }}
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  width: '100%',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '1.4rem' }}>❤️</p>
                  <p style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 700, color: '#f8d9a6' }}>{favoritesCount}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#c9a96f' }}>В обраному</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '1.4rem' }}>💬</p>
                  <p style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 700, color: '#f8d9a6' }}>{comments.length}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#c9a96f' }}>Коментарі</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '1.4rem' }}>⭐</p>
                  <p style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 700, color: '#f8d9a6' }}>{getAverageRating()}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#c9a96f' }}>Оцінка</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '1.4rem' }}>📅</p>
                  <p style={{ margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 700, color: '#f8d9a6' }}>
                    {isPremium ? getPremiumDaysLeft() : '—'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#c9a96f' }}>Днів Premium</p>
                </div>
              </div>
            </div>

            {/* Права картка: форма + кнопки */}
            <div
              style={{
                flex: '2 1 380px',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '18px',
                padding: '2rem',
                boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.2rem',
              }}
            >
              <section className="form" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', margin: 0, marginBottom: 0, padding: 0 }}>
                <input
                  placeholder="Ім’я користувача"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
                <input
                  placeholder="Електронна пошта"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <input
                  placeholder="Новий пароль (необов’язково)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </section>

              {/* Заповнення пустого простору — коротка довідка замість порожнечі */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  padding: '1rem 0',
                  background: 'rgba(112,84,68,0.12)',
                  border: '1px solid rgba(112,84,68,0.25)',
                  borderRadius: '12px',
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    padding: '0 1rem',
                    borderRight: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '1.4rem' }}>⏳</p>
                  <p style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 700, color: '#f8d9a6' }}>
                    {getDaysSinceJoined()}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#a58b6f' }}>Днів з нами</p>
                </div>

                <div style={{ textAlign: 'center', padding: '0 1rem' }}>
                  <p style={{ margin: 0, fontSize: '1.4rem' }}>📖</p>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#f8d9a6',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={getLastComment()?.bookId?.title || ''}
                  >
                    {getLastComment()
                      ? `${getLastComment()!.bookId?.title || 'Без назви'}${getLastComment()!.rating ? ` ⭐${getLastComment()!.rating}` : ''}`
                      : 'Ще немає'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#a58b6f' }}>Остання рецензія</p>
                </div>
              </div>

              {/* Кнопки */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '0.9rem',
                  }}
                >
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{
                      padding: '13px 12px',
                      backgroundColor: '#4c8a52',
                      color: '#f4e9d8', border: 'none', borderRadius: '10px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '15px', fontWeight: 600, transition: '0.3s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#5ba963')}
                    onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#4c8a52')}
                  >
                    💾 Зберегти
                  </button>

                  <button
                    onClick={handleReset}
                    disabled={loading}
                    style={{
                      padding: '13px 12px',
                      backgroundColor: '#d4a23b',
                      color: '#fff', border: 'none', borderRadius: '10px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '15px', fontWeight: 600, transition: '0.3s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#e1b75a')}
                    onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#d4a23b')}
                  >
                    ↩️ Скинути
                  </button>

                  <button
                    onClick={() => router.push('/')}
                    style={{
                      padding: '13px 12px',
                      backgroundColor: '#705444',
                      color: '#f8d9a6', border: 'none', borderRadius: '10px',
                      cursor: 'pointer', fontSize: '15px', fontWeight: 600, transition: '0.3s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#8a6652')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#705444')}
                  >
                    🏠 На головну
                  </button>
                </div>

                {!isPremium ? (
                  <button
                    onClick={() => router.push('/premium')}
                    style={{
                      width: '100%',
                      padding: '13px 20px',
                      backgroundColor: '#d4a23b',
                      color: '#fff', border: 'none', borderRadius: '10px',
                      cursor: 'pointer', fontSize: '15px', fontWeight: 600, transition: '0.3s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e1b75a')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#d4a23b')}
                  >
                    ✨ Отримати Premium
                  </button>
                ) : (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    style={{
                      width: '100%',
                      padding: '13px 20px',
                      backgroundColor: cancelling ? '#666' : '#8b4545',
                      color: '#fff', border: 'none', borderRadius: '10px',
                      cursor: cancelling ? 'not-allowed' : 'pointer',
                      fontSize: '15px', fontWeight: 600, transition: '0.3s',
                    }}
                    onMouseEnter={(e) => { if (!cancelling) e.currentTarget.style.backgroundColor = '#a55555'; }}
                    onMouseLeave={(e) => { if (!cancelling) e.currentTarget.style.backgroundColor = '#8b4545'; }}
                  >
                    {cancelling ? '⏳ Скасування...' : '🚫 Скасувати підписку'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* --- Додаткова інформація --- */}
          <div
            style={{
              marginTop: '1.5rem',
              textAlign: 'left',
              color: '#f8d9a6',
              fontSize: '1.05rem',
              position: 'relative',
              zIndex: 1,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '18px',
              padding: '1.75rem 2.2rem',
              boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
              width: '100%',
              boxSizing: 'border-box',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(3px)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#f8d9a6', fontSize: '1.3rem', letterSpacing: '0.6px', textShadow: '0 0 6px rgba(0,0,0,0.25)' }}>
                📜 Додаткова інформація
              </h3>
              <div style={{ width: '94%', height: '1px', borderRadius: '2px', marginTop: '0.7rem', background: 'rgba(255,255,255,0.2)' }} />
            </div>

            <div
              style={{
                marginTop: '1rem',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: isPremium
                  ? 'linear-gradient(135deg, rgba(212,162,59,0.15) 0%, rgba(244,208,63,0.1) 100%)'
                  : 'rgba(112,84,68,0.1)',
                borderRadius: '12px',
                border: isPremium ? '1px solid rgba(212,162,59,0.3)' : '1px solid rgba(112,84,68,0.2)',
              }}
            >
              <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.35 }}>
                <span style={{ marginRight: '8px' }}>⭐</span>
                <span style={{ color: '#c9a96f', marginRight: '6px' }}>Статус підписки:</span>
                <strong style={{ color: isPremium ? '#d4a23b' : '#8a6652' }}>
                  {isPremium ? 'Premium активний' : 'Безкоштовний акаунт'}
                </strong>
              </p>

              {isPremium && premiumUntil && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#c9a96f' }}>
                  <span style={{ marginRight: '8px' }}>📅</span>
                  Premium до: <strong style={{ color: '#d4a23b' }}>{formatDate(premiumUntil)}</strong>
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.35 }}>
                <span style={{ marginRight: '8px' }}>🧩</span>
                <span style={{ color: '#c9a96f', marginRight: '6px' }}>Роль:</span>
                <strong style={{ color: '#f8d9a6' }}>{role}</strong>
              </p>

              <p style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.35 }}>
                <span style={{ marginRight: '8px' }}>🗓️</span>
                <span style={{ color: '#c9a96f', marginRight: '6px' }}>Дата створення:</span>
                <strong style={{ color: userData.createdAt ? '#f8d9a6' : '#a58b6f' }}>
                  {userData.createdAt ? formatDate(userData.createdAt) : 'Немає даних'}
                </strong>
              </p>

              {userData.lastLogin && (
                <p style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.35 }}>
                  <span style={{ marginRight: '8px' }}>🔑</span>
                  <span style={{ color: '#c9a96f', marginRight: '6px' }}>Остання авторизація:</span>
                  <strong style={{ color: '#f8d9a6' }}>{formatDate(userData.lastLogin)}</strong>
                </p>
              )}

              {userData.updatedAt && (
                <p style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.35 }}>
                  <span style={{ marginRight: '8px' }}>✏️</span>
                  <span style={{ color: '#c9a96f', marginRight: '6px' }}>Останнє оновлення профілю:</span>
                  <strong style={{ color: '#f8d9a6' }}>{formatDate(userData.updatedAt)}</strong>
                </p>
              )}
            </div>
          </div>

          {message && (
            <p className="subtitle" style={{ marginTop: '1rem', zIndex: 1, position: 'relative', color: '#705444', textAlign: 'center' }}>
              {message}
            </p>
          )}
        </div>
      )}

      {/* === Вкладка КОМЕНТАРІ === */}
      {activeTab === 'comments' && (
        <section style={{ position: 'relative', zIndex: 1, marginTop: '1.5rem', color: '#f8d9a6', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>💬 Мої коментарі</h2>

          {commentsLoading ? (
            <p>⏳ Завантаження коментарів...</p>
          ) : comments.length === 0 ? (
            <p>Поки що немає коментарів</p>
          ) : (
            <>
              <p style={{ marginBottom: '0.5rem', color: '#c9a96f' }}>
                Середня оцінка: ⭐ {getAverageRating()}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '1rem' }}>
                {comments.map((comment) => (
                  <div
                    key={comment._id}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '12px',
                      padding: '1rem',
                      width: '90%',
                      maxWidth: '600px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'center',
                    }}
                  >
                    {comment.bookId?.coverUrl && (
                      <img
                        src={comment.bookId.coverUrl}
                        alt={comment.bookId.title}
                        style={{ width: 60, height: 85, objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8d9a6' }}>
                        {comment.bookId?.title || 'Без назви'}
                      </h3>
                      <p style={{ margin: 0, color: '#ddd' }}>{comment.content}</p>
                      {comment.rating && (
                        <p style={{ margin: '0.3rem 0', color: '#c9a96f' }}>⭐ {comment.rating}</p>
                      )}
                      <p style={{ fontSize: '0.8rem', color: '#a58b6f' }}>
                        {formatDate(comment.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(comment._id)}
                      style={{
                        background: 'transparent',
                        color: '#ff6b6b',
                        border: '1px solid #ff6b6b',
                        borderRadius: '8px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        transition: '0.3s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ff6b6b20')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      🗑 Видалити
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}