'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function AdminPanelPage() {
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

    return (
        <div
            className="page"
            style={{
                position: 'relative',
                overflow: 'hidden',
                minHeight: '100vh',
            }}
        >
            <canvas id="readgrid-web" className="readgrid-web"></canvas>

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

            <header
                className="header"
                style={{
                    marginBottom: '2rem',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                <div
                    className="logo-container"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                    }}
                >
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={85}
                        height={85}
                        className="logo"
                    />

                    <div style={{ textAlign: 'center' }}>
                        <p className="welcome-title fade-in-left">
                            Admin Panel{' '}
                            <span
                                className="welcome-emoji"
                                style={{
                                    textShadow:
                                        '0 0 8px rgba(248,217,166,0.6)',
                                }}
                            >
                                🛠️
                            </span>
                        </p>

                        <div className="welcome-divider"></div>

                        <p className="welcome-subtitle fade-in-right">
                            Панель керування ReadGrid{' '}
                            <span className="welcome-emoji">📚</span>
                        </p>
                    </div>
                </div>
            </header>

            <div
                style={{
                    width: '92%',
                    maxWidth: '960px',
                    margin: '0 auto',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Кнопка "На головну" по центру */}
                <div
                    style={{
                        display: 'flex',
                        gap: '1rem',
                        marginBottom: '2rem',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                    }}
                >
                    <Link
                        href="/"
                        className="nav-btn"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1.5rem',
                            fontSize: '1rem',
                            fontWeight: '600',
                        }}
                    >
                        <span>⬅️</span>
                        <span>На головну</span>
                    </Link>
                </div>

                {/* Два центральні блоки */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns:
                            'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1.5rem',
                    }}
                >
                    {/* Картка керування книгами */}
                    <Link
                        href="/admin/books"
                        style={{
                            textDecoration: 'none',
                            background:
                                'linear-gradient(135deg, rgba(42, 30, 26, 0.9) 0%, rgba(60, 43, 38, 0.9) 100%)',
                            border: '1px solid rgba(202, 169, 138, 0.2)',
                            borderRadius: '14px',
                            padding: '2rem',
                            color: '#f8d9a6',
                            boxShadow:
                                '0 6px 24px rgba(0,0,0,0.3)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform =
                                'translateY(-4px)';
                            e.currentTarget.style.borderColor =
                                'rgba(202, 169, 138, 0.5)';
                            e.currentTarget.style.boxShadow =
                                '0 10px 30px rgba(0,0,0,0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform =
                                'translateY(0)';
                            e.currentTarget.style.borderColor =
                                'rgba(202, 169, 138, 0.2)';
                            e.currentTarget.style.boxShadow =
                                '0 6px 24px rgba(0,0,0,0.3)';
                        }}
                    >
                        <div
                            style={{
                                fontSize: '3rem',
                                marginBottom: '1rem',
                                textAlign: 'center',
                            }}
                        >
                            📚
                        </div>

                        <h2
                            style={{
                                margin: '0 0 1rem',
                                fontSize: '1.4rem',
                                textAlign: 'center',
                                color: '#f8d9a6',
                            }}
                        >
                            Керування книгами 📖
                        </h2>

                        <p
                            style={{
                                margin: 0,
                                color: '#b8956b',
                                lineHeight: 1.7,
                                fontSize: '0.95rem',
                                textAlign: 'center',
                            }}
                        >
                            ➕ Додавання нових книг до каталогу<br />
                            ️ Редагування існуючих записів<br />
                            🗑️ Видалення книг<br />
                            ⭐ Встановлення premium-статусу<br />
                            🔍 Пошук та фільтрація
                        </p>

                        <div
                            style={{
                                marginTop: '1.5rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid rgba(202, 169, 138, 0.2)',
                                textAlign: 'center',
                                fontSize: '0.85rem',
                                color: '#8b7355',
                            }}
                        >
                            📋 Повний контроль над бібліотекою
                        </div>
                    </Link>

                    {/* Картка керування користувачами */}
                    <Link
                        href="/admin/users"
                        style={{
                            textDecoration: 'none',
                            background:
                                'linear-gradient(135deg, rgba(42, 30, 26, 0.9) 0%, rgba(60, 43, 38, 0.9) 100%)',
                            border: '1px solid rgba(202, 169, 138, 0.2)',
                            borderRadius: '14px',
                            padding: '2rem',
                            color: '#f8d9a6',
                            boxShadow:
                                '0 6px 24px rgba(0,0,0,0.3)',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform =
                                'translateY(-4px)';
                            e.currentTarget.style.borderColor =
                                'rgba(202, 169, 138, 0.5)';
                            e.currentTarget.style.boxShadow =
                                '0 10px 30px rgba(0,0,0,0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform =
                                'translateY(0)';
                            e.currentTarget.style.borderColor =
                                'rgba(202, 169, 138, 0.2)';
                            e.currentTarget.style.boxShadow =
                                '0 6px 24px rgba(0,0,0,0.3)';
                        }}
                    >
                        <div
                            style={{
                                fontSize: '3rem',
                                marginBottom: '1rem',
                                textAlign: 'center',
                            }}
                        >
                            👥
                        </div>

                        <h2
                            style={{
                                margin: '0 0 1rem',
                                fontSize: '1.4rem',
                                textAlign: 'center',
                                color: '#f8d9a6',
                            }}
                        >
                            Керування користувачами 👤
                        </h2>

                        <p
                            style={{
                                margin: 0,
                                color: '#b8956b',
                                lineHeight: 1.7,
                                fontSize: '0.95rem',
                                textAlign: 'center',
                            }}
                        >
                            👁️ Перегляд всіх користувачів<br />
                            🔑 Зміна ролей (user/admin)<br />
                            ⭐ Надання premium-доступу<br />
                            🚫 Блокування порушників<br />
                            ✅ Розблокування акаунтів<br />
                            📊 Статистика та аналітика
                        </p>

                        <div
                            style={{
                                marginTop: '1.5rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid rgba(202, 169, 138, 0.2)',
                                textAlign: 'center',
                                fontSize: '0.85rem',
                                color: '#8b7355',
                            }}
                        >
                            🛡️ Безпека та модерація платформи
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}