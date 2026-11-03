'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast/ToastContext';
import ConfirmModal from '@/components/ConfirmModal';
import { uploadFile } from '@/lib/uploadFile';

interface Book {
    _id: string;
    title: string;
    author: string;
    genre: string;
    year: number;
    description: string;
    coverUrl: string;
    fileUrl: string;
    isPremium: boolean;
}

function decodeJWT(token: string): any {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

const inputStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(202, 169, 138, 0.3)',
    backgroundColor: 'rgba(42, 30, 26, 0.6)',
    color: '#f4e9d8',
    transition: 'all 0.3s ease',
    width: '100%',
    boxSizing: 'border-box' as const,
};

const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#caa98a';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(202, 169, 138, 0.1)';
};
const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(202, 169, 138, 0.3)';
    e.currentTarget.style.boxShadow = 'none';
};

function FilePicker({
    icon, label, accept, file, inputKey, onPick,
}: {
    icon: string;
    label: string;
    accept: string;
    file: File | null;
    inputKey: number;
    onPick: (f: File | null) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const [isBtnHovered, setIsBtnHovered] = useState(false);

    return (
        <label
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                ...inputStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                borderColor: isHovered ? '#d4a23b' : 'rgba(202, 169, 138, 0.2)',
                boxShadow: isHovered ? '0 0 12px rgba(212, 162, 59, 0.15)' : 'none',
                backgroundColor: isHovered ? 'rgba(212, 162, 59, 0.05)' : 'rgba(0, 0, 0, 0.15)',
                boxSizing: 'border-box',
            }}
        >
            <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>{icon}</span>

            <span
                style={{
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
                    fontWeight: file ? 500 : 400,
                    color: file ? '#f8d9a6' : 'rgba(248, 217, 166, 0.65)',
                    transition: 'color 0.2s ease',
                }}
            >
                {file ? file.name : label}
            </span>

            {/* Кнопка Обрати/Змінити з ховером */}
            <span
                onMouseEnter={() => setIsBtnHovered(true)}
                onMouseLeave={() => setIsBtnHovered(false)}
                style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    backgroundColor: isBtnHovered ? '#8a6652' : '#705444',
                    color: '#f8d9a6',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    transform: isBtnHovered ? 'translateY(-1px) scale(1.03)' : 'translateY(0) scale(1)',
                    boxShadow: isBtnHovered ? '0 4px 12px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.2)',
                    userSelect: 'none',
                }}
            >
                {file ? 'Змінити' : 'Обрати'}
            </span>

            <input
                key={inputKey}
                type="file"
                accept={accept}
                hidden
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
        </label>
    );
}

export default function AdminBooksPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    const [form, setForm] = useState({
        title: '',
        author: '',
        genre: '',
        year: new Date().getFullYear(),
        description: '',
        coverUrl: '',
        fileUrl: '',
        filePublicId: '',
        isPremium: false,
    });

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [fileInputKey, setFileInputKey] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem('readgrid_token');
        if (!token) {
            router.push('/login');
            return;
        }

        const decoded = decodeJWT(token);
        if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'superadmin')) {
            showToast('Доступ заборонено. Тільки для адміністраторів.', 'error');
            router.push('/');
            return;
        }

        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
            localStorage.removeItem('readgrid_token');
            router.push('/login');
            return;
        }

        setIsAdmin(true);
    }, [router, showToast]);

    const getToken = () => localStorage.getItem('readgrid_token') || '';

    const fetchBooks = async () => {
        setLoading(true);
        setError(null);
        try {
            const timestamp = new Date().getTime();
            const res = await fetch(`/api/books?t=${timestamp}&limit=1000`, {
                headers: { Authorization: `Bearer ${getToken()}` },
                cache: 'no-store'
            });
            const data = await res.json();
            if (res.ok) setBooks(data.books);
            else setError(data.message || 'Failed to load books');
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchBooks();
        }
    }, [isAdmin]);

    const resetForm = () => {
        setForm({
            title: '',
            author: '',
            genre: '',
            year: new Date().getFullYear(),
            description: '',
            coverUrl: '',
            fileUrl: '',
            filePublicId: '',
            isPremium: false,
        });
        setEditingId(null);
        setError(null);
        setPdfFile(null);
        setCoverFile(null);
        setFileInputKey((k) => k + 1);
    };

    const prepareBody = async () => {
        let { coverUrl, fileUrl, filePublicId } = form;

        if (coverFile) {
            const r = await uploadFile(coverFile, 'image');
            coverUrl = r.url || '';
        }
        if (pdfFile) {
            const r = await uploadFile(pdfFile, 'raw', form.isPremium ? 'premium' : 'public');
            if (form.isPremium) { filePublicId = r.publicId; fileUrl = ''; }
            else { fileUrl = r.url || ''; filePublicId = ''; }
        }
        return { ...form, coverUrl, fileUrl, filePublicId };
    };

    const addBook = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/books', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify(await prepareBody()),
            });
            const data = await res.json();
            if (res.ok) {
                fetchBooks();
                resetForm();
                showToast('Книга успішно додана', 'success');
            } else {
                setError(data.message || 'Failed to add book');
                showToast(data.message || 'Не вдалося додати книгу', 'error');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
            showToast('Помилка мережі', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateBook = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/books/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify(await prepareBody()),
            });
            const data = await res.json();
            if (res.ok) {
                fetchBooks();
                resetForm();
                showToast('Книга успішно оновлена', 'success');
            } else {
                setError(data.message || 'Failed to update book');
                showToast(data.message || 'Не вдалося оновити книгу', 'error');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
            showToast('Помилка мережі', 'error');
        } finally {
            setLoading(false);
        }
    };

    const performDelete = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/books/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            const data = await res.json();
            if (res.ok) {
                fetchBooks();
                showToast('Книга успішно видалена', 'success');
            } else {
                setError(data.message || 'Failed to delete book');
                showToast(data.message || 'Не вдалося видалити книгу', 'error');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
            showToast('Помилка мережі', 'error');
        } finally {
            setLoading(false);
            setConfirmDeleteId(null);
        }
    };

    const requestDelete = (id: string) => {
        setConfirmDeleteId(id);
    };

    const startEditing = async (book: Book) => {
        setEditingId(book._id);

        let fileUrl = '';
        let filePublicId = '';
        try {
            const token = localStorage.getItem('readgrid_token');
            const res = await fetch(`/api/books/${book._id}/download`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                if (data.isPrivate) {
                    
                    filePublicId = data.filePublicId || '';
                } else {
                    fileUrl = data.fileUrl || '';
                }
            }
        } catch {
            
        }

        setPdfFile(null);
        setCoverFile(null);
        setFileInputKey((k) => k + 1);
        setForm({
            title: book.title,
            author: book.author,
            genre: book.genre,
            year: book.year,
            description: book.description,
            coverUrl: book.coverUrl,
            fileUrl,
            filePublicId,
            isPremium: book.isPremium || false,
        });
        setError(null);
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const booksPerPage = 5;

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
            setCurrentPage(1);
        }, 350);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [searchQuery]);

    const filteredBooks = useMemo(() => {
        return books.filter(book =>
            book.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            book.author.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            book.genre.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            book.year.toString().includes(debouncedSearchQuery)
        );
    }, [books, debouncedSearchQuery]);

    const indexOfLastBook = currentPage * booksPerPage;
    const indexOfFirstBook = indexOfLastBook - booksPerPage;
    const currentBooks = filteredBooks.slice(indexOfFirstBook, indexOfLastBook);
    const totalPages = Math.ceil(filteredBooks.length / booksPerPage);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    useEffect(() => {
        const canvas = document.createElement("canvas");
        canvas.id = "readgrid-web";
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "-60";
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

    if (!isAdmin) {
        return (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#caa98a' }}>
                <p>🔒 Checking access...</p>
            </div>
        );
    }

    const premiumCount = books.filter(b => b.isPremium).length;
    const standardCount = books.length - premiumCount;

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
                            Admin Books Panel <span className="welcome-emoji" style={{ textShadow: '0 0 8px rgba(248,217,166,0.6)' }}>🛠️</span>
                        </p>
                        <div className="welcome-divider"></div>
                        <p className="welcome-subtitle fade-in-right">Управління каталогом книг <span className="welcome-emoji">📚</span></p>
                    </div>
                </div>
            </header>

            {/* Збільшено maxWidth до 1200px для єдності зі сторінкою користувачів */}
            <div style={{ width: '95%', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

                {/* Навігація */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link href="/" className="nav-btn">⬅️ На головну</Link>
                    <span className="nav-btn" style={{ backgroundColor: '#705444', color: '#f8d9a6', cursor: 'default' }}>
                        📚 Каталог книг
                    </span>
                    <Link href="/admin/users" className="nav-btn">👥 Користувачі</Link>
                </div>

                {/* Статистика */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '1.2rem', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '1.4rem' }}>📚</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#f8d9a6' }}>{books.length}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9a96f' }}>Всього книг</p>
                    </div>
                    <div style={{ background: 'rgba(212,162,59,0.1)', border: '1px solid rgba(212,162,59,0.3)', borderRadius: '14px', padding: '1.2rem', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '1.4rem' }}>⭐</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#d4a23b' }}>{premiumCount}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9a96f' }}>Premium</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '1.2rem', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
                        <p style={{ margin: 0, fontSize: '1.4rem' }}>📖</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#f8d9a6' }}>{standardCount}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#c9a96f' }}>Звичайних</p>
                    </div>
                </div>

                {error && (
                    <div style={{ color: '#ff9999', marginBottom: '1rem', padding: '12px 20px', backgroundColor: 'rgba(255, 153, 153, 0.1)', border: '1px solid #ff9999', borderRadius: '8px', animation: 'slideIn 0.3s ease' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Форма додавання/редагування */}
                <div style={{ background: 'linear-gradient(135deg, rgba(42, 30, 26, 0.9) 0%, rgba(60, 43, 38, 0.9) 100%)', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 6px 24px rgba(0,0,0,0.3)', border: '1px solid rgba(202, 169, 138, 0.2)', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', boxSizing: 'border-box' }}>
                    <input placeholder="Назва книги" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
                    <input placeholder="Автор" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
                    <input placeholder="Жанр" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
                    <input type="number" min={1500} max={new Date().getFullYear()} placeholder="Рік видання" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
                    <input placeholder="Опис" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <select
                            value={form.isPremium ? 'premium' : 'standard'}
                            onChange={(e) => setForm({ ...form, isPremium: e.target.value === 'premium' })}
                            style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                padding: '12px 40px 12px 14px',
                                borderRadius: '8px',
                                border: '1px solid rgba(212, 162, 59, 0.3)',
                                backgroundColor: 'rgba(212, 162, 59, 0.15)',
                                color: '#d4a23b',
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                fontFamily: 'inherit',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                width: '100%',
                                boxSizing: 'border-box',
                                outline: 'none',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#d4a23b';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212, 162, 59, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(212, 162, 59, 0.3)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {/* Використовуєм суцільний темний фон #2a1e1a замість rgba */}
                            <option value="standard" style={{ backgroundColor: '#2a1e1a', color: '#f8d9a6' }}>
                                📖 Звичайна книга
                            </option>
                            <option value="premium" style={{ backgroundColor: '#2a1e1a', color: '#d4a23b' }}>
                                ⭐ Premium книга
                            </option>
                        </select>

                        {/* Кастомная стрелочка выпадающего списка */}
                        <span style={{ position: 'absolute', right: '14px', pointerEvents: 'none', color: '#d4a23b', fontSize: '0.75rem', opacity: 0.8 }}>
                            ▼
                        </span>
                    </div>

                    <input placeholder="Посилання на обкладинку" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur} />
                    <input
                        placeholder={form.filePublicId ? '🔒 Приватний файл (Premium)' : 'Посилання на файл книги'}
                        value={form.fileUrl}
                        disabled={!!form.filePublicId}
                        onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                        style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur}
                    />

                    <FilePicker icon="🖼️" label="Завантажити обкладинку" accept="image/*" file={coverFile} inputKey={fileInputKey} onPick={setCoverFile} />
                    <FilePicker icon="📄" label="Завантажити PDF" accept="application/pdf" file={pdfFile} inputKey={fileInputKey} onPick={setPdfFile} />

                    {form.isPremium && !form.filePublicId && !pdfFile && form.fileUrl && (
                        form.fileUrl.includes('res.cloudinary.com') ? (
                            <p style={{ gridColumn: '1 / -1', margin: 0, color: '#caa98a', fontSize: '0.85rem' }}>
                                🔒 Файл буде автоматично переведено в приватний режим при збереженні.
                            </p>
                        ) : (
                            <p style={{ gridColumn: '1 / -1', margin: 0, color: '#d4a23b', fontSize: '0.85rem' }}>
                                ⚠️ Це зовнішнє посилання, його не можна захистити. Завантажте PDF вище.
                            </p>
                        )
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', marginBottom: '2rem' }}>
                    <button onClick={() => (editingId ? updateBook(editingId) : addBook())} disabled={loading} style={{ padding: '11px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#705444', color: '#f8d9a6', fontWeight: '600', fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', boxShadow: '0 3px 10px rgba(0,0,0,0.3)' }} onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.backgroundColor = '#8a6652'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 5px 14px rgba(0,0,0,0.4)'; } }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#705444'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)'; }}>
                        {loading ? '⏳ Завантаження...' : editingId ? '💾 Зберегти зміни' : '➕ Додати книгу'}
                    </button>
                    {editingId && (
                        <button className="delete" onClick={resetForm} style={{ padding: '11px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#8b4545', color: '#f8d9a6', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 3px 10px rgba(0,0,0,0.3)' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#a55555'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 5px 14px rgba(0,0,0,0.4)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#8b4545'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)'; }}>
                            ✖️ Відмінити
                        </button>
                    )}
                </div>

                {/* Пошук */}
                <div style={{ marginBottom: '1.5rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '14px', fontSize: '1.2rem', opacity: 0.6, pointerEvents: 'none' }}>🔍</span>
                        <input type="text" placeholder="Пошук книги..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 40px', borderRadius: '10px', border: '1px solid rgba(202, 169, 138, 0.3)', backgroundColor: 'rgba(42, 30, 26, 0.7)', color: '#f4e9d8', fontSize: '1rem', transition: 'all 0.3s ease', textAlign: 'center', boxSizing: 'border-box' }} onFocus={(e) => { e.currentTarget.style.borderColor = '#caa98a'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(202, 169, 138, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202, 169, 138, 0.3)'; e.currentTarget.style.boxShadow = 'none'; }} />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#caa98a', fontSize: '1.2rem', cursor: 'pointer', padding: '4px', opacity: 0.7, transition: 'opacity 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}>✕</button>
                        )}
                    </div>
                    {debouncedSearchQuery && (
                        <p style={{ marginTop: '0.5rem', color: '#caa98a', fontSize: '0.9rem', textAlign: 'center' }}>
                            Знайдено: {filteredBooks.length} {filteredBooks.length === 1 ? 'книга' : filteredBooks.length < 5 ? 'книги' : 'книг'}
                        </p>
                    )}
                </div>

                {/* Таблиця книг */}
                <div>
                    {loading && !books.length ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#caa98a', fontSize: '1.1rem' }}>
                            <div style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block', fontSize: '2rem' }}>📚</div>
                            <p style={{ marginTop: '1rem' }}>Завантаження...</p>
                        </div>
                    ) : filteredBooks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#caa98a', fontSize: '1.1rem' }}>
                            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</p>
                            <p>Книг не знайдено</p>
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ marginTop: '1rem', padding: '10px 20px', backgroundColor: '#705444', color: '#f8d9a6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s ease' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#8a6652'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#705444'}>
                                    Скинути пошук
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div style={{ background: 'linear-gradient(135deg, rgba(42, 30, 26, 0.9) 0%, rgba(60, 43, 38, 0.9) 100%)', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 8px 28px rgba(0,0,0,0.35)', border: '1px solid rgba(202, 169, 138, 0.2)', overflowX: 'auto' }}>
                                <table className="book-table" style={{ width: '100%', borderCollapse: 'collapse', color: '#f4e9d8', fontFamily: 'Merriweather, serif' }}>
                                    <thead>
                                        <tr style={{ background: 'linear-gradient(135deg, #3c2b26 0%, #4a3730 100%)' }}>
                                            <th style={{ padding: '1rem 1.2rem', textAlign: 'left', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>📖 Назва</th>
                                            <th style={{ padding: '1rem 1.2rem', textAlign: 'left', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>✍️ Автор</th>
                                            <th style={{ padding: '1rem 1.2rem', textAlign: 'left', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>🎭 Жанр</th>
                                            <th style={{ padding: '1rem 1.2rem', textAlign: 'center', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>⭐ Premium</th>
                                            <th style={{ padding: '1rem 1.2rem', textAlign: 'left', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>📅 Рік</th>
                                            <th style={{ padding: '1rem 1.2rem', textAlign: 'center', fontWeight: '700', borderBottom: '2px solid #705444', color: '#c9a575', whiteSpace: 'nowrap' }}>⚙️ Дії</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentBooks.map((book, index) => (
                                            <tr key={book._id} style={{ borderBottom: '1px solid rgba(112, 84, 68, 0.3)', transition: 'all 0.3s ease', animation: `fadeInRow 0.4s ease ${index * 0.05}s both` }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(60, 43, 38, 0.5)'; e.currentTarget.style.transform = 'scale(1.01)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}>
                                                <td style={{ padding: '1rem 1.2rem', fontWeight: '600', fontSize: '0.95rem' }}>{book.title}</td>
                                                <td style={{ padding: '1rem 1.2rem', fontSize: '0.95rem' }}>{book.author}</td>
                                                <td style={{ padding: '1rem 1.2rem', fontStyle: 'italic', color: '#caa98a', fontSize: '0.95rem' }}>{book.genre}</td>
                                                <td style={{ padding: '1rem 1.2rem', textAlign: 'center', fontSize: '1.2rem' }}>
                                                    {book.isPremium ? <span style={{ color: '#f9d77e', filter: 'drop-shadow(0 0 4px rgba(249, 215, 126, 0.4))' }}>⭐</span> : <span style={{ color: '#7a5f4b' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '1rem 1.2rem', color: '#b89968', fontSize: '0.95rem' }}>{book.year}</td>
                                                <td style={{ padding: '1rem 1.2rem', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', alignItems: 'center' }}>
                                                        <button
                                                            onClick={() => { void startEditing(book); }}
                                                            disabled={loading}
                                                            title="Редагувати книгу"
                                                            style={{
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                backgroundColor: '#705444',
                                                                color: '#f8d9a6',
                                                                cursor: loading ? 'not-allowed' : 'pointer',
                                                                transition: 'all 0.25s ease',
                                                                fontSize: '1.1rem',
                                                                opacity: loading ? 0.5 : 1
                                                            }}
                                                            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.backgroundColor = '#8a6652'; e.currentTarget.style.transform = 'scale(1.15)'; } }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#705444'; e.currentTarget.style.transform = 'scale(1)'; }}
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            className="delete"
                                                            onClick={() => requestDelete(book._id)}
                                                            disabled={loading}
                                                            title="Видалити книгу"
                                                            style={{
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                backgroundColor: 'rgba(255,99,99,0.2)',
                                                                color: '#ff9999',
                                                                cursor: loading ? 'not-allowed' : 'pointer',
                                                                transition: 'all 0.25s ease',
                                                                fontSize: '1.1rem',
                                                                opacity: loading ? 0.5 : 1
                                                            }}
                                                            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.backgroundColor = 'rgba(255,99,99,0.3)'; e.currentTarget.style.transform = 'scale(1.15)'; } }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,99,99,0.2)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Пагінація */}
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                                    <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: currentPage === 1 ? 'rgba(112, 84, 68, 0.3)' : '#705444', color: '#f8d9a6', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', fontWeight: '600', fontSize: '0.9rem' }} onMouseEnter={(e) => { if (currentPage !== 1) { e.currentTarget.style.backgroundColor = '#8a6652'; e.currentTarget.style.transform = 'translateY(-2px)'; } }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = currentPage === 1 ? 'rgba(112, 84, 68, 0.3)' : '#705444'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                        ←
                                    </button>
                                    {[...Array(totalPages)].map((_, index) => {
                                        const pageNum = index + 1;
                                        return (
                                            <button key={pageNum} onClick={() => paginate(pageNum)} style={{ padding: '9px 14px', borderRadius: '8px', border: currentPage === pageNum ? '2px solid #caa98a' : 'none', backgroundColor: currentPage === pageNum ? '#8a6652' : '#705444', color: '#f8d9a6', cursor: 'pointer', transition: 'all 0.3s ease', fontWeight: currentPage === pageNum ? '700' : '600', minWidth: '40px', fontSize: '0.9rem' }} onMouseEnter={(e) => { if (currentPage !== pageNum) { e.currentTarget.style.backgroundColor = '#8a6652'; e.currentTarget.style.transform = 'translateY(-2px)'; } }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = currentPage === pageNum ? '#8a6652' : '#705444'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                    <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: currentPage === totalPages ? 'rgba(112, 84, 68, 0.3)' : '#705444', color: '#f8d9a6', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.3s ease', fontWeight: '600', fontSize: '0.9rem' }} onMouseEnter={(e) => { if (currentPage !== totalPages) { e.currentTarget.style.backgroundColor = '#8a6652'; e.currentTarget.style.transform = 'translateY(-2px)'; } }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = currentPage === totalPages ? 'rgba(112, 84, 68, 0.3)' : '#705444'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                        →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={confirmDeleteId !== null}
                title="Видалити книгу?"
                message="Цю дію неможливо скасувати. Книга буде видалена з каталогу назавжди."
                confirmLabel="Так, видалити"
                danger
                onConfirm={() => confirmDeleteId && performDelete(confirmDeleteId)}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <style jsx>{`
                @keyframes slideIn { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInRow { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}