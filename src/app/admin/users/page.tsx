'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type UserItem = {
    _id: string;
    username: string;
    email: string;
    role: 'user' | 'admin' | 'superadmin';
    isBlocked?: boolean;
    isPremium?: boolean;
    createdAt?: string;
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [message, setMessage] = useState('');
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('readgrid_token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setCurrentUserId(payload.userId);
                setCurrentUserRole(payload.role);
            } catch { }
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('readgrid_token');
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            const res = await fetch(`/api/admin/users?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
            } else {
                setMessage('❌ Немає доступу або сталася помилка');
            }
        } catch {
            setMessage(' Помилка мережі');
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        const timer = setTimeout(fetchUsers, 300);
        return () => clearTimeout(timer);
    }, [fetchUsers]);

    const updateUser = async (
        id: string,
        update: Partial<{ role: 'user' | 'admin' | 'superadmin'; isBlocked: boolean; isPremium: boolean }>
    ) => {
        setBusyIds(prev => new Set(prev).add(id));
        const token = localStorage.getItem('readgrid_token');
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(update),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessage(`❌ ${data.message || 'Не вдалося оновити користувача'}`);
                return;
            }
            setUsers(prev => prev.map(u => u._id === id ? { ...u, ...update } : u));
            setMessage('✅ Оновлено');
        } catch {
            setMessage('❌ Помилка мережі');
        } finally {
            setBusyIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    // Анімована "павутина" на фоні
    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.id = 'readgrid-web';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '-60';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const mouse = { x: width / 2, y: height / 2, radius: 120 };

        const onResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', onResize);

        type Point = { x: number; y: number; vx: number; vy: number; phase: number };
        const points: Point[] = [];
        const pointCount = 50;

        for (let i = 0; i < pointCount; i++) {
            points.push({
                x: 85 + Math.random() * (width - 170),
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                phase: Math.random() * Math.PI * 2,
            });
        }

        let raf: number;
        const draw = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < pointCount; i++) {
                const p1 = points[i];
                if (p1.x <= 85 || p1.x >= width - 85) continue;

                for (let j = i + 1; j < pointCount; j++) {
                    const p2 = points[j];
                    if (p2.x <= 85 || p2.x >= width - 85) continue;

                    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                    if (dist < 160) {
                        const alpha = 0.05 + (1 - dist / 160) * 0.15 + 0.05 * Math.sin(p1.phase + Date.now() * 0.002);
                        ctx.strokeStyle = `rgba(210,180,140,${alpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }

            for (let i = 0; i < pointCount; i++) {
                const p = points[i];
                p.x += p.vx;
                p.y += p.vy;
                p.phase += 0.01;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist < mouse.radius) {
                    const force = (mouse.radius - dist) / mouse.radius;
                    p.vx -= dx * 0.0002 * force;
                    p.vy -= dy * 0.0002 * force;
                }

                if (p.x > 85 && p.x < width - 85) {
                    ctx.fillStyle = `rgba(210,180,140,${0.2 + 0.1 * Math.sin(p.phase)})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            raf = requestAnimationFrame(draw);
        };

        draw();

        const onMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        window.addEventListener('mousemove', onMouseMove);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(raf);
            canvas.remove();
        };
    }, []);

    const adminCount = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);
    const superadminCount = useMemo(() => users.filter(u => u.role === 'superadmin').length, [users]);
    const premiumCount = useMemo(() => users.filter(u => u.isPremium).length, [users]);
    const blockedCount = useMemo(() => users.filter(u => u.isBlocked).length, [users]);

    return (
        <div className="page" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
            <canvas id="readgrid-web" className="readgrid-web"></canvas>

            <div style={{ position: 'absolute', top: 0, left: 0, width: '85px', height: '100%', backgroundImage: 'url("/side-left.png")', backgroundRepeat: 'repeat-y', backgroundSize: 'contain', opacity: 0.1, filter: 'blur(0.3px) brightness(1.1)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: '85px', height: '100%', backgroundImage: 'url("/side-right.png")', backgroundRepeat: 'repeat-y', backgroundSize: 'contain', opacity: 0.1, filter: 'blur(0.3px) brightness(1.1)', pointerEvents: 'none', zIndex: 0 }} />

            <header className="header" style={{ marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
                <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Image src="/logo.png" alt="Logo" width={85} height={85} className="logo" />
                    <div style={{ textAlign: 'center' }}>
                        <p className="welcome-title fade-in-left">
                            Admin Users Panel <span className="welcome-emoji" style={{ textShadow: '0 0 8px rgba(248,217,166,0.6)' }}>👥</span>
                        </p>
                        <div className="welcome-divider"></div>
                        <p className="welcome-subtitle fade-in-right">
                            Керування користувачами ReadGrid <span className="welcome-emoji">📚</span>
                        </p>
                    </div>
                </div>
            </header>

            <div style={{ width: '95%', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link href="/" className="nav-btn">⬅️ На головну</Link>
                    <Link href="/admin/books" className="nav-btn">📚 Каталог книг</Link>
                    <span className="nav-btn" style={{ backgroundColor: '#705444', color: '#f8d9a6', cursor: 'default' }}>
                        👥 Користувачі
                    </span>
                </div>

                {/* 🆕 Додано картку Superadmin */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '1.2rem', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '1.4rem' }}>👥</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#f8d9a6' }}>{users.length}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9a96f' }}>Всього</p>
                    </div>
                    <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: '14px', padding: '1.2rem', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '1.4rem' }}>👑</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#ffd700' }}>{superadminCount}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9a96f' }}>Суперадмін</p>
                    </div>
                    <div style={{ background: 'rgba(212,162,59,0.1)', border: '1px solid rgba(212,162,59,0.3)', borderRadius: '14px', padding: '1.2rem', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '1.4rem' }}>⚡</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#d4a23b' }}>{adminCount}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9a96f' }}>Адмінів</p>
                    </div>
                    <div style={{ background: 'rgba(212,162,59,0.1)', border: '1px solid rgba(212,162,59,0.3)', borderRadius: '14px', padding: '1.2rem', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '1.4rem' }}>⭐</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#f4d03f' }}>{premiumCount}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9a96f' }}>Premium</p>
                    </div>
                    <div style={{ background: 'rgba(255,99,99,0.08)', border: '1px solid rgba(255,99,99,0.3)', borderRadius: '14px', padding: '1.2rem', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '1.4rem' }}>🚫</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#ff9999' }}>{blockedCount}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9a96f' }}>Заблоковано</p>
                    </div>
                </div>

                {message && (
                    <div style={{ color: message.includes('✅') ? '#a8e6a1' : '#ff9999', marginBottom: '1rem', padding: '12px 20px', backgroundColor: message.includes('✅') ? 'rgba(168,230,161,0.1)' : 'rgba(255,153,153,0.1)', border: `1px solid ${message.includes('✅') ? '#a8e6a1' : '#ff9999'}`, borderRadius: '8px', animation: 'slideIn 0.3s ease' }}>
                        {message}
                    </div>
                )}

                <div style={{ marginBottom: '1.5rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '14px', fontSize: '1.2rem', opacity: 0.6, pointerEvents: 'none' }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Пошук за ім'ям або email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '12px 40px', borderRadius: '10px', border: '1px solid rgba(202, 169, 138, 0.3)', backgroundColor: 'rgba(42, 30, 26, 0.7)', color: '#f4e9d8', fontSize: '1rem', transition: 'all 0.3s ease', textAlign: 'center', boxSizing: 'border-box' }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = '#caa98a'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(202, 169, 138, 0.1)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202, 169, 138, 0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#caa98a', fontSize: '1.2rem', cursor: 'pointer', padding: '4px', opacity: 0.7, transition: 'opacity 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}></button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#caa98a', fontSize: '1.1rem' }}>
                        <div style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block', fontSize: '2rem' }}>👥</div>
                        <p style={{ marginTop: '1rem' }}>Завантаження...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#caa98a', fontSize: '1.1rem' }}>
                        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</p>
                        <p>Користувачів не знайдено</p>
                    </div>
                ) : (
                    <div style={{ background: 'linear-gradient(135deg, rgba(42, 30, 26, 0.9) 0%, rgba(60, 43, 38, 0.9) 100%)', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 8px 28px rgba(0,0,0,0.35)', border: '1px solid rgba(202, 169, 138, 0.2)', overflowX: 'auto' }}>
                        <table className="book-table" style={{ width: '100%', borderCollapse: 'collapse', color: '#f4e9d8', fontFamily: 'Merriweather, serif' }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(135deg, #3c2b26 0%, #4a3730 100%)' }}>
                                    <th style={{ padding: '1rem 1.2rem', textAlign: 'left', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}> Користувач</th>
                                    <th style={{ padding: '1rem 1.2rem', textAlign: 'left', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>✉️ Email</th>
                                    <th style={{ padding: '1rem 1.2rem', textAlign: 'left', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>🏷️ Статус</th>
                                    <th style={{ padding: '1rem 1.2rem', textAlign: 'left', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>📅 З дати</th>
                                    <th style={{ padding: '1rem 1.2rem', textAlign: 'center', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>️ Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, index) => {
                                    const isSelf = u._id === currentUserId;
                                    const isBusy = busyIds.has(u._id);

                                    // Логіка прав доступу
                                    const isTargetHighLevel = u.role === 'admin' || u.role === 'superadmin';
                                    const canModifyRole = currentUserRole === 'superadmin'; //  Тільки SuperAdmin може змінювати ролі
                                    const canBlock = currentUserRole === 'superadmin' || !isTargetHighLevel; // Admin може блокувати тільки звичайних

                                    return (
                                        <tr key={u._id} style={{ borderBottom: '1px solid rgba(112, 84, 68, 0.3)', transition: 'all 0.3s ease', animation: `fadeInRow 0.4s ease ${index * 0.05}s both` }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(60, 43, 38, 0.5)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                            <td style={{ padding: '1rem 1.2rem', fontWeight: '600', fontSize: '0.95rem' }}>{u.username}</td>
                                            <td style={{ padding: '1rem 1.2rem', color: '#caa98a', fontSize: '0.9rem' }}>{u.email}</td>
                                            <td style={{ padding: '1rem 1.2rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {u.role === 'superadmin' && (
                                                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#ffd700', background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.35)', letterSpacing: '0.5px' }}>
                                                            👑 Суперадмін
                                                        </span>
                                                    )}
                                                    {u.role === 'admin' && (
                                                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#d4a23b', background: 'rgba(212,162,59,0.15)', border: '1px solid rgba(212,162,59,0.35)', letterSpacing: '0.5px' }}>
                                                            ⚡ Адмін
                                                        </span>
                                                    )}
                                                    {u.isPremium && (
                                                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, color: '#f4d03f', background: 'rgba(212,162,59,0.12)', border: '1px solid rgba(212,162,59,0.25)' }}>
                                                            ⭐ Premium
                                                        </span>
                                                    )}
                                                    {u.isBlocked && (
                                                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, color: '#ff9999', background: 'rgba(255,99,99,0.12)', border: '1px solid rgba(255,99,99,0.25)' }}>
                                                            🚫 Заблок.
                                                        </span>
                                                    )}
                                                    {u.role === 'user' && !u.isPremium && !u.isBlocked && (
                                                        <span style={{ color: '#7a5f4b', fontSize: '0.85rem' }}>Користувач</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.2rem', color: '#b89968', fontSize: '0.9rem' }}>
                                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString('uk-UA') : '—'}
                                            </td>
                                            <td style={{ padding: '1rem 1.2rem', textAlign: 'center' }}>
                                                {isSelf ? (
                                                    <span style={{ color: '#8b6b57', fontStyle: 'italic', fontSize: '0.85rem' }}>Ваш акаунт</span>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', alignItems: 'center' }}>

                                                        {/* 🔑 Кнопка зміни ролі */}
                                                        <button
                                                            disabled={isBusy || !canModifyRole}
                                                            onClick={() => updateUser(u._id, { role: u.role === 'admin' ? 'user' : 'admin' })}
                                                            title={
                                                                !canModifyRole
                                                                    ? 'Тільки Суперадмін може змінювати права інших адмінів'
                                                                    : (u.role === 'admin' ? 'Зняти адмінку' : 'Зробити адміном')
                                                            }
                                                            style={{
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                backgroundColor: !canModifyRole ? 'rgba(150, 150, 150, 0.1)' : (u.role === 'admin' ? 'rgba(212,162,59,0.2)' : '#705444'),
                                                                color: !canModifyRole ? '#666' : (u.role === 'admin' ? '#d4a23b' : '#f8d9a6'),
                                                                cursor: (isBusy || !canModifyRole) ? 'not-allowed' : 'pointer',
                                                                transition: 'all 0.25s ease',
                                                                fontSize: '1.2rem',
                                                                opacity: (isBusy || !canModifyRole) ? 0.4 : 1,
                                                                minWidth: '44px',
                                                                minHeight: '44px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isBusy && canModifyRole) {
                                                                    e.currentTarget.style.transform = 'scale(1.15)';
                                                                    e.currentTarget.style.backgroundColor = u.role === 'admin' ? 'rgba(212,162,59,0.3)' : '#8a6652';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.transform = 'scale(1)';
                                                                e.currentTarget.style.backgroundColor = !canModifyRole ? 'rgba(150, 150, 150, 0.1)' : (u.role === 'admin' ? 'rgba(212,162,59,0.2)' : '#705444');
                                                            }}
                                                        >
                                                            {!canModifyRole ? (
                                                                <span>🔒</span>
                                                            ) : u.role === 'admin' ? (
                                                                <span>⚡</span>
                                                            ) : (
                                                                <span>👑</span>
                                                            )}
                                                        </button>

                                                        {/* ⭐ Кнопка Premium (доступна ВСІМ адмінам для ВСІХ користувачів, включаючи інших адмінів) */}
                                                        <button
                                                            disabled={isBusy} // Блокується тільки під час завантаження
                                                            onClick={() => updateUser(u._id, { isPremium: !u.isPremium })}
                                                            title={u.isPremium ? 'Зняти Premium' : 'Дати Premium'}
                                                            style={{
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                backgroundColor: u.isPremium ? 'rgba(244,208,63,0.2)' : '#705444',
                                                                color: u.isPremium ? '#f4d03f' : '#f8d9a6',
                                                                cursor: isBusy ? 'not-allowed' : 'pointer',
                                                                transition: 'all 0.25s ease',
                                                                fontSize: '1.2rem',
                                                                opacity: isBusy ? 0.5 : 1,
                                                                minWidth: '44px',
                                                                minHeight: '44px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isBusy) {
                                                                    e.currentTarget.style.transform = 'scale(1.15)';
                                                                    e.currentTarget.style.backgroundColor = u.isPremium ? 'rgba(244,208,63,0.3)' : '#8a6652';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.transform = 'scale(1)';
                                                                e.currentTarget.style.backgroundColor = u.isPremium ? 'rgba(244,208,63,0.2)' : '#705444';
                                                            }}
                                                        >
                                                            <span>⭐</span>
                                                        </button>

                                                        {/* 🚫 Кнопка Блокування */}
                                                        <button
                                                            disabled={isBusy || !canBlock}
                                                            onClick={() => updateUser(u._id, { isBlocked: !u.isBlocked })}
                                                            title={
                                                                !canBlock
                                                                    ? 'Тільки Суперадмін може блокувати інших адмінів'
                                                                    : (u.isBlocked ? 'Розблокувати' : 'Заблокувати')
                                                            }
                                                            style={{
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                backgroundColor: !canBlock ? 'rgba(150, 150, 150, 0.1)' : (u.isBlocked ? 'rgba(168,230,161,0.2)' : 'rgba(255,99,99,0.2)'),
                                                                color: !canBlock ? '#666' : (u.isBlocked ? '#a8e6a1' : '#ff9999'),
                                                                cursor: (isBusy || !canBlock) ? 'not-allowed' : 'pointer',
                                                                transition: 'all 0.25s ease',
                                                                fontSize: '1.2rem',
                                                                opacity: (isBusy || !canBlock) ? 0.4 : 1,
                                                                minWidth: '44px',
                                                                minHeight: '44px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isBusy && canBlock) {
                                                                    e.currentTarget.style.transform = 'scale(1.15)';
                                                                    e.currentTarget.style.backgroundColor = u.isBlocked ? 'rgba(168,230,161,0.3)' : 'rgba(255,99,99,0.3)';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.transform = 'scale(1)';
                                                                e.currentTarget.style.backgroundColor = !canBlock ? 'rgba(150, 150, 150, 0.1)' : (u.isBlocked ? 'rgba(168,230,161,0.2)' : 'rgba(255,99,99,0.2)');
                                                            }}
                                                        >
                                                            {!canBlock ? (
                                                                <span>🔒</span>
                                                            ) : u.isBlocked ? (
                                                                <span>✅</span>
                                                            ) : (
                                                                <span>🚫</span>
                                                            )}
                                                        </button>

                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes slideIn { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInRow { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}