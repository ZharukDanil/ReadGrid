// src/app/premium/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { jwtDecode } from 'jwt-decode';

type DecodedToken = {
    userId: string;
    username: string;
    role: string;
    exp: number;
};

export default function PremiumPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [testMode, setTestMode] = useState<boolean | null>(null);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [demoLoading, setDemoLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('readgrid_token');
        if (!token) { setAuthChecked(true); return; }

        try {
            const decoded = jwtDecode<DecodedToken>(token);
            if (decoded.exp * 1000 > Date.now() && (decoded.role === 'admin' || decoded.role === 'superadmin')) {
                setIsAdmin(true);
                fetchSettings(token);
            } else {
                setAuthChecked(true);
            }
        } catch {
            setAuthChecked(true);
        }
    }, []);

    const fetchSettings = async (token: string) => {
        try {
            const res = await fetch('/api/admin/settings', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (res.ok) {
                const data = await res.json();
                setTestMode(data.paymentTestMode);
            }
        } catch (err) {
            console.error('Fetch settings error:', err);
        } finally {
            setAuthChecked(true);
        }
    };

    const toggleTestMode = async () => {
        if (testMode === null) return;
        setSettingsLoading(true);
        const token = localStorage.getItem('readgrid_token');
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ paymentTestMode: !testMode }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setTestMode(data.paymentTestMode);
            } else {
                setMessage(`❌ ${data.message || 'Не вдалося змінити режим'}`);
            }
        } catch {
            setMessage('❌ Помилка мережі');
        } finally {
            setSettingsLoading(false);
        }
    };

    const handleDemoActivate = async (plan: 'monthly' | 'yearly') => {
        setDemoLoading(true);
        setMessage('⏳ Демо-активація...');
        const token = localStorage.getItem('readgrid_token');
        try {
            const res = await fetch('/api/payment/demo-activate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ plan }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage('✅ Premium активовано в демо-режимі!');
            } else {
                setMessage(`❌ ${data.message || 'Не вдалося активувати демо-режим'}`);
            }
        } catch {
            setMessage('❌ Помилка мережі');
        } finally {
            setDemoLoading(false);
        }
    };

    useEffect(() => {
        const canvas = document.createElement("canvas");
        canvas.id = "readgrid-web";
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "0";
        document.body.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const mouse = { x: width / 2, y: height / 2, radius: 120 };

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        type Point = { x: number; y: number; vx: number; vy: number; phase: number };
        const points: Point[] = [];
        const pointCount = 50;

        for (let i = 0; i < pointCount; i++) {
            points.push({
                x: 85 + Math.random() * (width - 170),
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                phase: Math.random() * Math.PI * 2
            });
        }

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

            requestAnimationFrame(draw);
        };

        draw();

        const onMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        window.addEventListener('mousemove', onMouseMove);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            canvas.remove();
        };
    }, []);

    const handlePurchase = async (plan: 'monthly' | 'yearly') => {
        setLoading(true);
        setMessage('⏳ Створення платежу...');

        try {
            const token = localStorage.getItem('readgrid_token');
            const res = await fetch('/api/payment/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ plan }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Помилка створення платежу');
            }

            // Відкриваємо форму WayForPay
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'https://secure.wayforpay.com/pay';
            form.style.display = 'none';

            Object.entries(data.paymentData).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = Array.isArray(value) ? value.join(';') : String(value);
                form.appendChild(input);
            });

            document.body.appendChild(form);
            form.submit();
        } catch (err: any) {
            setMessage(`❌ ${err.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="page" style={{ position: 'relative', minHeight: '100vh' }}>
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
                    filter: 'blur(0.3px)',
                    pointerEvents: 'none',
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
                    filter: 'blur(0.3px)',
                    pointerEvents: 'none',
                }}
            />

            {/* Контент */}
            <header style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                <h1 style={{ fontSize: '2.5rem', color: '#f8d9a6', marginBottom: '0.5rem' }}>
                    ✨ ReadGrid Premium
                </h1>
                <p style={{ color: '#c9a96f', fontSize: '1.2rem' }}>
                    Отримайте доступ до ексклюзивного каталогу книг!
                </p>

                {/* === Тонкая линия === */}
                <div
                    style={{
                        width: '560px',
                        height: '1px',
                        margin: '0.5rem auto',
                        backgroundColor: 'rgba(248, 217, 166, 0.5)',
                        borderRadius: '1px',
                    }}
                />
            </header>

            <section
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '2rem',
                    maxWidth: '900px',
                    margin: '0 auto 2rem',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Місячна підписка */}
                <div
                    style={{
                        background: 'linear-gradient(135deg, rgba(112,84,68,0.2) 0%, rgba(160,126,101,0.2) 100%)',
                        borderRadius: '20px',
                        padding: '2rem',
                        border: '2px solid rgba(248,217,166,0.3)',
                        textAlign: 'center',
                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <h2 style={{ fontSize: '1.8rem', color: '#f8d9a6', marginBottom: '1rem' }}>
                        📅 Місячна підписка
                    </h2>
                    <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#4c8a52', marginBottom: '1rem' }}>
                        99₴
                    </p>
                    <ul style={{ textAlign: 'left', color: '#c9a96f', marginBottom: '2rem', listStyle: 'none', padding: 0 }}>
                        <li style={{ marginBottom: '0.5rem' }}>✅ Доступ до 500+ преміум книг</li>
                        <li style={{ marginBottom: '0.5rem' }}>✅ Без реклами</li>
                        <li style={{ marginBottom: '0.5rem' }}>✅ Ранній доступ до новинок</li>
                        <li style={{ marginBottom: '0.5rem' }}>✅ Підтримка розробників</li>
                    </ul>
                    <button
                        onClick={() => handlePurchase('monthly')}
                        disabled={loading}
                        style={{
                            padding: '12px 28px',
                            backgroundColor: '#4c8a52',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: '0.3s',
                        }}
                        onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#5ba963')}
                        onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#4c8a52')}
                    >
                        {loading ? '⏳ Обробка...' : '💳 Купити місячну'}
                    </button>
                </div>

                {/* Річна підписка */}
                <div
                    style={{
                        background: 'linear-gradient(135deg, rgba(196,127,95,0.3) 0%, rgba(212,162,59,0.3) 100%)',
                        borderRadius: '20px',
                        padding: '2rem',
                        border: '3px solid #d4a23b',
                        textAlign: 'center',
                        position: 'relative',
                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(212,162,59,0.5)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: '-15px',
                            right: '20px',
                            background: '#d4a23b',
                            color: '#1a1410',
                            padding: '5px 15px',
                            borderRadius: '20px',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                        }}
                    >
                        🔥 -20% Економія
                    </div>
                    <h2 style={{ fontSize: '1.8rem', color: '#f8d9a6', marginBottom: '1rem' }}>
                        📆 Річна підписка
                    </h2>
                    <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#d4a23b', marginBottom: '1rem' }}>
                        999₴
                    </p>
                    <p style={{ color: '#a58b6f', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        <s>1188₴</s> — заощаджуйте 189₴!
                    </p>
                    <ul style={{ textAlign: 'left', color: '#c9a96f', marginBottom: '2rem', listStyle: 'none', padding: 0 }}>
                        <li style={{ marginBottom: '0.5rem' }}>✅ Доступ до 500+ преміум книг</li>
                        <li style={{ marginBottom: '0.5rem' }}>✅ Без реклами</li>
                        <li style={{ marginBottom: '0.5rem' }}>✅ Ранній доступ до новинок</li>
                        <li style={{ marginBottom: '0.5rem' }}>✅ Підтримка розробників</li>
                        <li style={{ marginBottom: '0.5rem' }}>⭐ Пріоритетна підтримка</li>
                    </ul>
                    <button
                        onClick={() => handlePurchase('yearly')}
                        disabled={loading}
                        style={{
                            padding: '12px 28px',
                            backgroundColor: '#d4a23b',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: '0.3s',
                        }}
                        onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#e1b75a')}
                        onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#d4a23b')}
                    >
                        {loading ? '⏳ Обробка...' : '💳 Купити річну'}
                    </button>
                </div>
            </section>

            {/* Адмін-панель — стиль як у блоках профілю: суцільна картка, внутрішня "плашка" статусу */}
            {isAdmin && (
                <section
                    style={{
                        maxWidth: '700px',
                        margin: '0 auto 2rem',
                        padding: '1.8rem 2rem',
                        background: 'rgba(139,69,69,0.08)',
                        border: '2px dashed rgba(212,162,59,0.5)',
                        borderRadius: '16px',
                        position: 'relative',
                        zIndex: 1,
                        opacity: authChecked ? 1 : 0,
                        transform: authChecked ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
                        transition: 'opacity 0.4s ease, transform 0.4s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                        boxShadow: '0 0 0 rgba(212,162,59,0)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                        e.currentTarget.style.borderColor = 'rgba(212,162,59,0.9)';
                        e.currentTarget.style.boxShadow = '0 10px 28px rgba(212,162,59,0.2)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.borderColor = 'rgba(212,162,59,0.5)';
                        e.currentTarget.style.boxShadow = '0 0 0 rgba(212,162,59,0)';
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>⚙️</span>
                        <h3 style={{ color: '#d4a23b', fontSize: '1.15rem', margin: 0 }}>
                            Адмін-панель: тестовий режим оплати
                        </h3>
                    </div>

                    <p style={{ color: '#a58b6f', fontSize: '0.88rem', textAlign: 'center', marginBottom: '1.3rem', lineHeight: 1.5 }}>
                        У тестовому режимі будь-який адмін/суперадмін може активувати Premium собі
                        без реальної оплати через WayForPay — зручно для демонстрації.
                    </p>

                    {/* Статус — темна "плашка" всередині пунктирної картки, для контрасту */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(0,0,0,0.25)',
                            borderRadius: '10px',
                            padding: '0.9rem 1.2rem',
                            marginBottom: testMode ? '1.2rem' : 0,
                        }}
                    >
                        <span style={{ color: '#f8d9a6', fontWeight: 600 }}>
                            Статус:{' '}
                            <span style={{ color: testMode === null ? '#a58b6f' : testMode ? '#6fbf73' : '#d97a6c' }}>
                                {testMode === null ? '⏳ Завантаження...' : testMode ? '🟢 Увімкнено' : '🔴 Вимкнено'}
                            </span>
                        </span>
                        <button
                            onClick={toggleTestMode}
                            disabled={testMode === null || settingsLoading}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '8px',
                                border: 'none',
                                background: testMode
                                    ? 'linear-gradient(135deg, #8b4545 0%, #a85858 100%)'
                                    : 'linear-gradient(135deg, #4c8a52 0%, #5ba963 100%)',
                                color: '#fff',
                                cursor: settingsLoading ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            }}
                        >
                            {settingsLoading ? '⏳...' : testMode ? 'Вимкнути' : 'Увімкнути'}
                        </button>
                    </div>

                    {testMode && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            {(['monthly', 'yearly'] as const).map((plan) => (
                                <button
                                    key={plan}
                                    onClick={() => handleDemoActivate(plan)}
                                    disabled={demoLoading}
                                    style={{
                                        padding: '10px 22px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(0,0,0,0.25)',
                                        background: 'linear-gradient(135deg, #e0b24a 0%, #c89a3a 100%)',
                                        color: '#2a1b12',
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        cursor: demoLoading ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
                                        transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (demoLoading) return;
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.background = 'linear-gradient(135deg, #ecc066 0%, #d4a845 100%)';
                                        e.currentTarget.style.boxShadow = '0 6px 14px rgba(212,168,69,0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.background = 'linear-gradient(135deg, #e0b24a 0%, #c89a3a 100%)';
                                        e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.35)';
                                    }}
                                >
                                    🧪 Демо: {plan === 'monthly' ? 'місячна' : 'річна'}
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {message && (
                <p style={{ textAlign: 'center', color: '#f8d9a6', fontSize: '1.1rem', marginTop: '1rem' }}>
                    {message}
                </p>
            )}

            <button
                onClick={() => router.push('/')}
                style={{
                    padding: '10px 22px',
                    background: 'linear-gradient(135deg, #705444 0%, #8a6652 100%)',
                    color: '#f8d9a6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: '0.3s',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #8a6652 0%, #a07b66 100%)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #705444 0%, #8a6652 100%)';
                }}
            >
                🏠 На головну
            </button>

        </div>
    );
}