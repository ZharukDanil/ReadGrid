'use client';
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { jwtDecode } from "jwt-decode";
import CommentsSection from '@/components/CommentsSection/CommentsSection';
import WebBackground from '@/components/WebBackground';

type Book = {
    _id: string;
    title: string;
    author: string;
    genre: string;
    year: number;
    description: string;
    coverUrl: string;
    fileUrl: string;
    isPremium?: boolean;
};

type DecodedToken = {
    userId: string;
    username: string;
    role: string;
    exp: number;
};

export default function BookDetailsPage() {
    const { id } = useParams();
    const [book, setBook] = useState<Book | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [username, setUsername] = useState("");
    const [role, setRole] = useState("");
    const [isFavorite, setIsFavorite] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("readgrid_token");
        if (token) {
            try {
                const decoded = jwtDecode<DecodedToken>(token);
                if (decoded.exp * 1000 > Date.now()) {
                    setIsAuthorized(true);
                    setUsername(decoded.username);
                    setRole(decoded.role);
                    setUserId(decoded.userId);
                    checkFavorite(token);
                    fetchUserPremiumStatus(decoded.userId, token);
                } else {
                    localStorage.removeItem("readgrid_token");
                }
            } catch {
                setIsAuthorized(false);
            }
        }
    }, []);

    const checkFavorite = async (token: string) => {
        try {
            const res = await fetch('/api/favorites', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
            });

            if (res.ok) {
                const data = await res.json();
                const favoriteIds = data.favorites.map((book: Book) => book._id);
                setIsFavorite(favoriteIds.includes(id));
            }
        } catch (error) {
            console.error('Check favorite error:', error);
        }
    };

    const fetchUserPremiumStatus = async (userId: string, token: string) => {
        try {
            const res = await fetch(`/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setIsPremium(data.isPremium || false);
            }
        } catch (error) {
            console.error('Premium status error:', error);
        }
    };

    const toggleFavorite = async () => {
        const token = localStorage.getItem("readgrid_token");
        if (!token) return;

        try {
            if (isFavorite) {
                const res = await fetch(`/api/favorites?bookId=${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    setIsFavorite(false);
                }
            } else {
                const res = await fetch('/api/favorites', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ bookId: id }),
                });
                if (res.ok) {
                    setIsFavorite(true);
                }
            }
        } catch (error) {
            console.error('Toggle favorite error:', error);
        }
    };

    useEffect(() => {
        if (!id) return;
        fetch(`/api/books/${id}`)
            .then((res) => res.json())
            .then((data) => {
                if (data && data._id) {
                    setBook(data);
                } else {
                    setBook(null);
                    setNotFound(true);
                }
            })
            .catch(() => {
                setBook(null);
                setNotFound(true);
            });
    }, [id]);

    const handleShare = async () => {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Copy to clipboard error:', error);
        }
    };

    if (notFound) {
        return (
            <div style={{ textAlign: "center", marginTop: "4rem", color: "#caa98a" }}>
                <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>📕</p>
                <h1 style={{ color: "#f8d9a6", fontSize: "1.6rem", marginBottom: "0.5rem" }}>
                    Книгу не знайдено
                </h1>
                <p style={{ marginBottom: "1.5rem" }}>
                    Можливо, вона була видалена або посилання невірне
                </p>
                <Link href="/" className="nav-btn">🏠 На головну</Link>
            </div>
        );
    }

    if (!book) {
        return (
            <div style={{ textAlign: "center", marginTop: "4rem", color: "#caa98a" }}>
                <p>⏳ Завантаження книги...</p>
            </div>
        );
    }

    return (
        <div className="page" style={{ position: "relative", overflow: "hidden", padding: "2rem" }}>
            <WebBackground />

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
                    opacity: 0.12,
                    filter: 'blur(0.4px) brightness(1.1)',
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
                    opacity: 0.12,
                    filter: 'blur(0.4px) brightness(1.1)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />

            <Link href="/" className="nav-btn" style={{ marginBottom: "1.5rem", display: "inline-block", position: 'relative', zIndex: 2 }}>
                ⬅️ На головну
            </Link>

            {/* === Верхній блок: обкладинка + інформація (старий стиль) === */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: "2rem",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    position: 'relative',
                    zIndex: 2,
                }}
            >
                <div style={{ position: 'relative' }}>
                    <img
                        src={book.coverUrl}
                        alt={book.title}
                        style={{
                            width: "300px",
                            height: "460px",
                            borderRadius: "12px",
                            objectFit: "cover",
                            boxShadow: "0 0 15px rgba(0,0,0,0.3)",
                        }}
                    />

                    {book.isPremium && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                background: 'linear-gradient(135deg, #d4a23b 0%, #f4d03f 100%)',
                                color: '#1a1410',
                                padding: '5px 12px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                zIndex: 10,
                                boxShadow: '0 2px 8px rgba(212,162,59,0.5)',
                            }}
                        >
                            ⭐ Premium
                        </div>
                    )}

                    {isAuthorized && (
                        <button
                            onClick={toggleFavorite}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                border: 'none',
                                background: isFavorite
                                    ? 'linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%)'
                                    : 'rgba(255,255,255,0.3)',
                                color: isFavorite ? '#fff' : '#caa98a',
                                fontSize: '1.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title={isFavorite ? 'Видалити з обраного' : 'Додати в обране'}
                        >
                            {isFavorite ? '❤️' : '🤍'}
                        </button>
                    )}
                </div>

                <div style={{ maxWidth: "600px" }}>
                    <h1 style={{ color: "#f8d9a6", fontSize: "2rem" }}>{book.title}</h1>
                    <p style={{ color: "#caa98a", fontSize: "1.1rem" }}>
                        ✍️ Автор: <strong>{book.author}</strong>
                    </p>
                    <p style={{ color: "#caa98a" }}>📚 Жанр: {book.genre}</p>
                    <p style={{ color: "#caa98a" }}>📅 Рік видання: {book.year}</p>
                    <p style={{ marginTop: "1rem", color: "#d8c3a5", lineHeight: "1.6" }}>{book.description}</p>

                    {typeof (book as any).avgRating === 'number' && (book as any).ratingsCount > 0 ? (
                        <p style={{ color: "#f8d9a6", fontWeight: 600 }}>
                            ⭐ Середній рейтинг: {(book as any).avgRating.toFixed(1)} / 5 ({(book as any).ratingsCount} оцінок)
                        </p>
                    ) : (
                        <p style={{ color: "#a07e65" }}>⭐ Ще немає оцінок</p>
                    )}

                    <div style={{ marginTop: "2rem", display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {isAuthorized ? (
                            <>
                                {book.isPremium && !isPremium ? (
                                    <Link
                                        href="/premium"
                                        className="read-btn"
                                        style={{
                                            backgroundColor: "#d4a23b",
                                            color: "#fff",
                                            padding: "10px 18px",
                                            borderRadius: "8px",
                                            textDecoration: "none",
                                            display: "inline-block",
                                        }}
                                    >
                                        ⭐ Отримати Premium для завантаження
                                    </Link>
                                ) : (
                                    <a
                                        href={book.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="read-btn"
                                        style={{
                                            backgroundColor: "#705444",
                                            color: "#f8d9a6",
                                            padding: "10px 18px",
                                            borderRadius: "8px",
                                        }}
                                    >
                                        📥 Завантажити книгу
                                    </a>
                                )}

                                <button
                                    onClick={toggleFavorite}
                                    className="read-btn"
                                    style={{
                                        backgroundColor: isFavorite ? "#ff6b6b" : "#705444",
                                        color: "#f8d9a6",
                                        padding: "10px 18px",
                                        borderRadius: "8px",
                                    }}
                                >
                                    {isFavorite ? '💔 Видалити з обраного' : '❤️ Додати в обране'}
                                </button>
                            </>
                        ) : (
                            <p style={{ color: "#caa98a", fontStyle: "italic" }}>
                                🔒 Увійдіть, щоб завантажити файл та додати в обране
                            </p>
                        )}

                        <button
                            onClick={handleShare}
                            className="read-btn"
                            style={{
                                backgroundColor: copied ? "#4c8a52" : "#705444",
                                color: "#f8d9a6",
                                padding: "10px 18px",
                                borderRadius: "8px",
                            }}
                        >
                            {copied ? '✅ Скопійовано!' : '🔗 Поділитися'}
                        </button>
                    </div>
                </div>
            </div>

            {/* === Відгуки та коментарі (новий стиль) === */}
            <section
                style={{
                    marginTop: "2.5rem",
                    padding: "2.2rem 2.5rem",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: "20px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.3)",
                    position: "relative",
                    zIndex: 2,
                    width: "100%",
                    maxWidth: "1400px",
                    marginLeft: "auto",
                    marginRight: "auto",
                    boxSizing: 'border-box',
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '1.6rem' }}>
                    <p className="welcome-title" style={{ margin: 0 }}>
                        Відгуки та коментарі <span className="welcome-emoji">💬</span>
                    </p>
                    <div className="welcome-divider"></div>
                    <p style={{ color: "#a07e65", fontSize: "1rem", fontStyle: "italic", margin: '0.6rem 0 0' }}>
                        Поділися своїми враженнями від книги або прочитай, що думають інші 📖
                    </p>
                </div>

                <div
                    style={{
                        backgroundColor: "rgba(27, 20, 17, 0.5)",
                        borderRadius: "16px",
                        padding: "2rem",
                        border: "1px solid rgba(255,255,255,0.1)",
                        boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.25)",
                    }}
                >
                    <CommentsSection bookId={book._id} />
                </div>
            </section>
        </div>
    );
}