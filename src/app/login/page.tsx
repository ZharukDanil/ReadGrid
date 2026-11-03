'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [form, setForm] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // Ефект паутинки
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

    const handleLogin = async () => {
        if (!form.email || !form.password) {
            setMessage('❗ Заповніть усі поля');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post('/api/login', form);
            const { token } = res.data;
            localStorage.setItem('readgrid_token', token);
            setMessage('✅ Авторизація успішна!');
            setTimeout(() => router.push('/'), 1500);
        } catch (err: any) {
            const msg = err.response?.data?.message || '❌ Авторизація не вдалася';
            setMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1410 0%, #2a1e1a 50%, #1a1410 100%)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
        }}>
            {/* Бокові зображення */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '85px',
                height: '100%',
                backgroundImage: 'url("/side-left.png")',
                backgroundRepeat: 'repeat-y',
                backgroundSize: 'contain',
                opacity: 0.08,
                filter: 'blur(0.5px) brightness(1.2)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '85px',
                height: '100%',
                backgroundImage: 'url("/side-right.png")',
                backgroundRepeat: 'repeat-y',
                backgroundSize: 'contain',
                opacity: 0.08,
                filter: 'blur(0.5px) brightness(1.2)',
                pointerEvents: 'none',
            }} />

            {/* Основна карточка */}
            <div style={{
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
            }}>
                {/* Логотип і заголовок */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
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
                    }}>
                        <img
                            src="/logo.png"
                            alt="ReadGrid"
                            style={{
                                width: '70px',
                                height: '70px',
                                borderRadius: '50%',
                            }}
                        />
                    </div>

                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        color: '#f8d9a6',
                        marginBottom: '0.5rem',
                        textShadow: '0 0 20px rgba(248, 217, 166, 0.3)',
                        letterSpacing: '1px',
                    }}>
                        ReadGrid
                    </h1>

                    <p style={{
                        color: '#caa98a',
                        fontSize: '1rem',
                        fontWeight: 400,
                    }}>
                        🔑 Вхід до системи
                    </p>
                </div>

                {/* Форма */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Email */}
                    <div>
                        <label style={{
                            display: 'block',
                            color: '#d8c3a5',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            marginBottom: '0.5rem',
                            marginLeft: '0.25rem',
                        }}>
                            📧 Email
                        </label>
                        <input
                            placeholder="example@mail.com"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            style={{
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
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(248, 217, 166, 0.6)';
                                e.currentTarget.style.background = 'rgba(46, 38, 33, 0.8)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(112, 84, 68, 0.3)';
                                e.currentTarget.style.background = 'rgba(46, 38, 33, 0.6)';
                            }}
                        />
                    </div>

                    {/* Пароль */}
                    <div>
                        {/* Контейнер для вирівнювання заголовка та посилання по краях */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                            paddingLeft: '0.25rem',
                            paddingRight: '0.25rem'
                        }}>
                            <label style={{
                                color: '#d8c3a5',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                            }}>
                                🔒 Пароль
                            </label>

                            <Link
                                href="/forgot-password"
                                style={{
                                    color: '#c9a96f',
                                    fontSize: '0.9rem',
                                    textDecoration: 'underline',
                                    transition: 'color 0.3s ease', /* Плавна зміна кольору */
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#f8d9a6'; /* Колір при наведенні (можна змінити на #fff для максимальної яскравості) */
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#c9a96f'; /* Повертаємо початковий колір */
                                }}
                            >
                                Забули пароль?
                            </Link>
                        </div>

                        <input
                            placeholder="Введіть пароль"
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            style={{
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
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(248, 217, 166, 0.6)';
                                e.currentTarget.style.background = 'rgba(46, 38, 33, 0.8)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(112, 84, 68, 0.3)';
                                e.currentTarget.style.background = 'rgba(46, 38, 33, 0.6)';
                            }}
                        />
                    </div>
                </div>

                {/* Кнопки */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: loading
                                ? 'rgba(112, 84, 68, 0.4)'
                                : 'linear-gradient(135deg, #705444 0%, #8b6b57 100%)',
                            color: '#f8d9a6',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1.05rem',
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: loading ? 'none' : '0 4px 15px rgba(112, 84, 68, 0.4)',
                            letterSpacing: '0.5px',
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(112, 84, 68, 0.6)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(112, 84, 68, 0.4)';
                            }
                        }}
                    >
                        {loading ? '⏳ Авторизація...' : '🔑 Увійти'}
                    </button>

                    <Link
                        href="/"
                        style={{
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
                        }}
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
                        🏠 На головну
                    </Link>
                </div>

                {/* Повідомлення */}
                {message && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        borderRadius: '10px',
                        background: message.includes('✅')
                            ? 'rgba(168, 230, 161, 0.1)'
                            : message.includes('❗')
                                ? 'rgba(255, 193, 7, 0.1)'
                                : 'rgba(255, 99, 99, 0.1)',
                        border: `1px solid ${message.includes('✅')
                            ? 'rgba(168, 230, 161, 0.3)'
                            : message.includes('❗')
                                ? 'rgba(255, 193, 7, 0.3)'
                                : 'rgba(255, 99, 99, 0.3)'
                            }`,
                        color: message.includes('✅')
                            ? '#a8e6a1'
                            : message.includes('❗')
                                ? '#ffc107'
                                : '#ff9999',
                        textAlign: 'center',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                    }}>
                        {message}
                    </div>
                )}

                {/* Посилання на реєстрацію */}
                <div style={{
                    marginTop: '2rem',
                    textAlign: 'center',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid rgba(112, 84, 68, 0.2)',
                }}>
                    <p style={{ color: '#a07e65', fontSize: '0.95rem' }}>
                        Ще немає акаунту?{' '}
                        <Link
                            href="/register"
                            style={{
                                color: '#f8d9a6',
                                textDecoration: 'none',
                                fontWeight: 600,
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ffd966';
                                e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#f8d9a6';
                                e.currentTarget.style.textDecoration = 'none';
                            }}
                        >
                            Зареєструватися →
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}