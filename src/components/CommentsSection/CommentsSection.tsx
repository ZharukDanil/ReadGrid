'use client';
import React, { useEffect, useState } from 'react';

type CommentItem = {
    _id: string;
    content: string;
    rating?: number;
    userId: { _id?: string; username?: string; role?: string } | string | null;
    createdAt: string;
};

type DecodedToken = { userId?: string; username?: string; role?: string; exp?: number };

function decodeJWT(token: string): DecodedToken | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1];

        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const decoded = new TextDecoder('utf-8').decode(bytes);
        return JSON.parse(decoded);
    } catch (error) {
        console.error('JWT decode error:', error);
        return null;
    }
}

export default function CommentsSection({ bookId }: { bookId: string }) {
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useState('');
    const [rating, setRating] = useState<number | ''>('');
    const [message, setMessage] = useState('');
    const [isAuth, setIsAuth] = useState(false);
    const [currentUser, setCurrentUser] = useState<DecodedToken | null>(null);
    const [userHasRating, setUserHasRating] = useState(false);
    const [bookData, setBookData] = useState<any>(null);

    useEffect(() => {
        const token = localStorage.getItem('readgrid_token');
        if (token) {
            try {
                const d = decodeJWT(token);
                if (d && d.exp && d.exp * 1000 > Date.now()) {
                    setIsAuth(true);
                    setCurrentUser(d);
                } else {
                    localStorage.removeItem('readgrid_token');
                }
            } catch {
                setIsAuth(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!bookId) return;
        const timestamp = new Date().getTime();
        fetch(`/api/books/${bookId}?t=${timestamp}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setBookData(data))
            .catch(err => console.error('Помилка завантаження книги:', err));
    }, [bookId]);

    useEffect(() => {
        if (!bookId) return;
        fetchComments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId]);

    const fetchComments = async () => {
        if (!bookId) return;
        setLoading(true);
        try {
            const timestamp = new Date().getTime();
            const res = await fetch(`/api/comments?bookId=${bookId}&t=${timestamp}`, {
                cache: "no-store"
            });
            if (res.ok) {
                const data = await res.json();
                setComments(data.comments || []);

                if (currentUser?.userId) {
                    const hasRated = data.comments.some((c: CommentItem) => {
                        const uid = typeof c.userId === 'object' && c.userId ? c.userId._id : c.userId;
                        return uid === currentUser.userId && c.rating !== undefined && c.rating !== null;
                    });
                    setUserHasRating(hasRated);
                }
            }
        } catch (error) {
            console.error("Помилка при завантаженні коментарів:", error);
        } finally {
            setLoading(false);
        }
    };

    function stripHtml(input = '') {
        return input.replace(/<\/?[^>]+(>|$)/g, '');
    }

    const handleSubmit = async () => {
        setMessage('');
        if (!isAuth) {
            setMessage('Увійдіть, щоб залишити відгук');
            return;
        }

        const clean = stripHtml(text).trim();
        if (clean.length < 3) {
            setMessage('Коментар має бути мінімум 3 символи');
            return;
        }
        if (clean.length > 1000) {
            setMessage('Коментар занадто довгий (максимум 1000)');
            return;
        }

        let r = undefined;
        if (rating !== '' && !userHasRating) {
            r = Number(rating);
            if (Number.isNaN(r) || r < 1 || r > 5) {
                setMessage('Рейтинг має бути від 1 до 5');
                return;
            }
        }

        const token = localStorage.getItem('readgrid_token');
        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ bookId, commentText: clean, rating: r }),
            });

            const responseText = await res.text();
            let data: any = {};
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                setMessage('Помилка: сервер повернув невалідну відповідь');
                return;
            }

            if (!res.ok) {
                setMessage(data.message || data.error || 'Помилка при додаванні коментаря');
                return;
            }

            setText('');
            setRating('');
            setMessage('✅ Коментар додано');

            setTimeout(async () => {
                const timestamp = new Date().getTime();
                const bookRes = await fetch(`/api/books/${bookId}?t=${timestamp}`, { cache: 'no-store' });
                const bookData = await bookRes.json();
                setBookData(bookData);
                await fetchComments();
            }, 500);

        } catch (err: any) {
            setMessage('Помилка мережі: ' + (err.message || 'Невідома помилка'));
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!currentUser) return;
        const token = localStorage.getItem('readgrid_token');
        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Не вдалося видалити коментар');

            await fetchComments();

            const timestamp = new Date().getTime();
            const bookRes = await fetch(`/api/books/${bookId}?t=${timestamp}`, { cache: 'no-store' });
            const updatedBookData = await bookRes.json();
            setBookData(updatedBookData);

            setMessage('✅ Коментар видалено');
        } catch (err) {
            console.error(err);
            setMessage('Помилка при видаленні коментаря');
        }
    };

    const [page, setPage] = useState(1);
    const commentsPerPage = 5;

    const paginatedComments = comments.slice(
        (page - 1) * commentsPerPage,
        page * commentsPerPage
    );

    const totalPages = Math.ceil(comments.length / commentsPerPage);

    // 🔥 Функція для отримання імені користувача
    const getUserName = (userId: CommentItem['userId']): string => {
        if (!userId) return '👻 Видалений користувач';
        if (typeof userId === 'object') {
            return userId.username || '👻 Видалений користувач';
        }
        return '👻 Видалений користувач';
    };

    // 🆕 Дані для аватара — перша буква імені + роль (для золотої обводки адмінів)
    const getAvatarInfo = (userId: CommentItem['userId']) => {
        if (!userId || typeof userId !== 'object' || !userId.username) {
            return { letter: '?', isAdmin: false, isDeleted: true };
        }
        return {
            letter: userId.username.charAt(0).toUpperCase(),
            isAdmin: userId.role === 'admin',
            isDeleted: false,
        };
    };

    return (
        <div style={{
            marginTop: "3rem",
            padding: "0",
            maxWidth: "1100px",
            marginLeft: "auto",
            marginRight: "auto",
        }}>
            {/* Середній рейтинг книги */}
            {bookData?.avgRating > 0 && bookData?.ratingsCount > 0 && (
                <div style={{
                    textAlign: "center",
                    marginBottom: "2.5rem",
                    padding: "1.5rem",
                    backgroundColor: "rgba(112, 84, 68, 0.15)",
                    borderRadius: "12px",
                    border: "2px solid rgba(255, 217, 102, 0.3)",
                }}>
                    <div style={{
                        color: "#ffd966",
                        fontSize: "2.5rem",
                        marginBottom: "0.5rem",
                        textShadow: "0 0 10px rgba(255, 217, 102, 0.5)"
                    }}>
                        ⭐ {bookData.avgRating}
                    </div>
                    <div style={{ color: "#f8d9a6", fontSize: "1.1rem", fontWeight: 500 }}>
                        Середній рейтинг
                    </div>
                    <div style={{ color: "#a07e65", fontSize: "0.95rem", marginTop: "0.3rem" }}>
                        на основі {bookData.ratingsCount} {bookData.ratingsCount === 1 ? 'оцінки' : 'оцінок'}
                    </div>
                </div>
            )}

            {/* Форма додавання коментаря */}
            <div style={{
                marginBottom: "3rem",
                padding: "2rem",
                backgroundColor: "rgba(27, 20, 17, 0.7)",
                borderRadius: "16px",
                border: "1px solid rgba(112, 84, 68, 0.4)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}>
                <h3 style={{
                    color: "#f8d9a6",
                    fontSize: "1.6rem",
                    fontWeight: 600,
                    textAlign: "center",
                    marginBottom: "1.5rem",
                    textShadow: "0 0 8px rgba(248,217,166,0.4)",
                    letterSpacing: "0.5px",
                }}>
                    💬 Залишити коментар
                </h3>

                {isAuth ? (
                    <>
                        <textarea
                            rows={5}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Поділися своїми враженнями про книгу..."
                            style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: "10px",
                                border: "2px solid rgba(112,84,68,0.3)",
                                background: "rgba(46, 38, 33, 0.8)",
                                color: "#f8d9a6",
                                fontSize: "1rem",
                                resize: "vertical",
                                outline: "none",
                                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)",
                                transition: "border-color 0.3s ease",
                                boxSizing: "border-box",
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = "rgba(112,84,68,0.6)"}
                            onBlur={(e) => e.currentTarget.style.borderColor = "rgba(112,84,68,0.3)"}
                        />

                        <div style={{
                            marginTop: "1.25rem",
                            display: "flex",
                            gap: "1rem",
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}>
                            {!userHasRating ? (
                                <select
                                    value={rating === '' ? '' : String(rating)}
                                    onChange={(e) =>
                                        setRating(e.target.value === '' ? '' : Number(e.target.value))
                                    }
                                    style={{
                                        flex: "1",
                                        minWidth: "200px",
                                        backgroundColor: "#3a2c24",
                                        color: "#f8d9a6",
                                        border: "2px solid rgba(112,84,68,0.4)",
                                        borderRadius: "8px",
                                        padding: "0.8rem 1rem",
                                        fontSize: "1.05rem",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                        outline: "none",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "rgba(112,84,68,0.7)";
                                        e.currentTarget.style.backgroundColor = "#453329";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "rgba(112,84,68,0.4)";
                                        e.currentTarget.style.backgroundColor = "#3a2c24";
                                    }}
                                >
                                    <option value="">⭐ Оберіть оцінку (опціонально)</option>
                                    <option value="1">★☆☆☆☆ Жахливо (1)</option>
                                    <option value="2">★★☆☆☆ Погано (2)</option>
                                    <option value="3">★★★☆☆ Нормально (3)</option>
                                    <option value="4">★★★★☆ Добре (4)</option>
                                    <option value="5">★★★★★ Чудово (5)</option>
                                </select>
                            ) : (
                                <div style={{
                                    flex: "1",
                                    minWidth: "200px",
                                    color: "#a07e65",
                                    fontSize: "0.95rem",
                                    fontStyle: "italic",
                                    padding: "0.8rem 1rem",
                                    backgroundColor: "rgba(160, 126, 101, 0.1)",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(160, 126, 101, 0.3)",
                                }}>
                                    ℹ️ Ви вже поставили оцінку цій книзі
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                style={{
                                    flex: "0 0 auto",
                                    minWidth: "160px",
                                    background: "linear-gradient(135deg, #705444 0%, #8b6b57 100%)",
                                    color: "#f8d9a6",
                                    borderRadius: "8px",
                                    padding: "0.8rem 1.5rem",
                                    fontSize: "1.05rem",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: "pointer",
                                    transition: "all 0.3s ease",
                                    boxShadow: "0 4px 12px rgba(112, 84, 68, 0.4)",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(112, 84, 68, 0.6)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(112, 84, 68, 0.4)";
                                }}
                            >
                                📤 Відправити
                            </button>
                        </div>

                        {message && (
                            <div style={{
                                marginTop: "1rem",
                                padding: "0.8rem 1rem",
                                color: message.includes('✅') ? "#a8e6a1" : "#ff9999",
                                backgroundColor: message.includes('✅') ? "rgba(168, 230, 161, 0.1)" : "rgba(255, 153, 153, 0.1)",
                                borderRadius: "8px",
                                border: `1px solid ${message.includes('✅') ? 'rgba(168, 230, 161, 0.3)' : 'rgba(255, 153, 153, 0.3)'}`,
                                fontSize: "0.95rem",
                                textAlign: "center",
                            }}>
                                {message}
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{
                        padding: "2rem",
                        textAlign: "center",
                        backgroundColor: "rgba(112, 84, 68, 0.1)",
                        borderRadius: "10px",
                        border: "1px dashed rgba(112, 84, 68, 0.3)",
                    }}>
                        <p style={{ color: "#caa98a", fontSize: "1.1rem", margin: 0 }}>
                            🔒 Увійдіть, щоб залишити коментар
                        </p>
                    </div>
                )}
            </div>

            {/* Список коментарів */}
            <div>
                <h4 style={{
                    color: "#f8d9a6",
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    marginBottom: "1.5rem",
                    textAlign: "center",
                    textShadow: "0 0 6px rgba(248,217,166,0.3)",
                    letterSpacing: "0.5px",
                }}>
                    💭 Коментарі читачів ({comments.length})
                </h4>

                {loading ? (
                    <div style={{
                        padding: "3rem",
                        textAlign: "center",
                        color: "#a07e65",
                        fontSize: "1.1rem",
                    }}>
                        ⏳ Завантаження...
                    </div>
                ) : comments.length === 0 ? (
                    <div style={{
                        padding: "3rem",
                        textAlign: "center",
                        backgroundColor: "rgba(27, 20, 17, 0.5)",
                        borderRadius: "12px",
                        border: "1px solid rgba(112, 84, 68, 0.2)",
                    }}>
                        <p style={{ color: "#a07e65", fontSize: "1.1rem", margin: 0 }}>
                            📚 Поки що немає коментарів. Будьте першим!
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gap: "1.25rem" }}>
                        {paginatedComments.map((c) => {
                            const userId = c.userId && typeof c.userId === 'object' ? c.userId._id : null;
                            const canDelete =
                                currentUser &&
                                (currentUser.role === 'admin' || currentUser.userId === userId);

                            const avatar = getAvatarInfo(c.userId);

                            return (
                                <div key={c._id} style={{
                                    padding: "1.5rem",
                                    borderRadius: "12px",
                                    backgroundColor: "rgba(27, 20, 17, 0.7)",
                                    border: "1px solid rgba(112,84,68,0.3)",
                                    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                                    transition: "all 0.3s ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = "rgba(112,84,68,0.5)";
                                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = "rgba(112,84,68,0.3)";
                                    e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
                                }}
                                >
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "1rem",
                                        paddingBottom: "0.75rem",
                                        borderBottom: "1px solid rgba(112,84,68,0.2)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            {/* 🆕 Аватар — перша буква імені, в стилі профілю */}
                                            <div style={{
                                                width: "38px",
                                                height: "38px",
                                                borderRadius: "50%",
                                                background: avatar.isDeleted
                                                    ? "rgba(112,84,68,0.25)"
                                                    : "radial-gradient(circle at 35% 30%, #6b4e38 0%, #4a3527 55%, #35261b 100%)",
                                                border: avatar.isAdmin
                                                    ? "2px solid #d4a23b"
                                                    : "2px solid #a3805f",
                                                boxShadow: avatar.isAdmin
                                                    ? "0 0 10px rgba(212,162,59,0.5), inset 0 1px 3px rgba(0,0,0,0.3)"
                                                    : "inset 0 1px 3px rgba(0,0,0,0.3)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "1rem",
                                                fontWeight: 700,
                                                color: "#fdeecb",
                                                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                                                flexShrink: 0,
                                            }}>
                                                {avatar.isDeleted ? '👻' : avatar.letter}
                                            </div>
                                            <strong style={{
                                                color: c.userId ? "#f8d9a6" : "#a07e65",
                                                fontSize: "1.05rem",
                                                fontStyle: c.userId ? 'normal' : 'italic'
                                            }}>
                                                {getUserName(c.userId)}
                                            </strong>
                                            {avatar.isAdmin && (
                                                <span style={{
                                                    padding: '2px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.4px',
                                                    textTransform: 'uppercase',
                                                    color: '#d4a23b',
                                                    background: 'rgba(212,162,59,0.15)',
                                                    border: '1px solid rgba(212,162,59,0.35)',
                                                }}>
                                                    ⚡ Адмін
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <span style={{ color: "#a07e65", fontSize: "0.9rem" }}>
                                                📅 {new Date(c.createdAt).toLocaleDateString('uk-UA')}
                                            </span>
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(c._id)}
                                                    style={{
                                                        background: "rgba(255, 99, 99, 0.1)",
                                                        color: "#ff9999",
                                                        border: "1px solid rgba(255, 99, 99, 0.3)",
                                                        borderRadius: "6px",
                                                        padding: "0.4rem 0.8rem",
                                                        cursor: "pointer",
                                                        fontSize: "0.9rem",
                                                        transition: "all 0.3s ease",
                                                    }}
                                                    title="Видалити коментар"
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = "rgba(255, 99, 99, 0.2)";
                                                        e.currentTarget.style.borderColor = "rgba(255, 99, 99, 0.5)";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = "rgba(255, 99, 99, 0.1)";
                                                        e.currentTarget.style.borderColor = "rgba(255, 99, 99, 0.3)";
                                                    }}
                                                >
                                                    🗑️ Видалити
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{
                                        color: "#d8c3a5",
                                        fontSize: "1rem",
                                        lineHeight: "1.6",
                                        marginBottom: c.rating ? "1rem" : "0",
                                    }}>
                                        {c.content}
                                    </div>
                                    {c.rating && (
                                        <div style={{
                                            display: "inline-block",
                                            padding: "0.5rem 1rem",
                                            backgroundColor: "rgba(255, 217, 102, 0.15)",
                                            borderRadius: "8px",
                                            border: "1px solid rgba(255, 217, 102, 0.3)",
                                        }}>
                                            <span style={{ color: "#ffd966", fontSize: "1.2rem", fontWeight: 600 }}>
                                                {"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}
                                            </span>
                                            <span style={{ color: "#a07e65", fontSize: "0.9rem", marginLeft: "0.5rem" }}>
                                                ({c.rating}/5)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Пагінація */}
            {totalPages > 1 && (
                <div style={{
                    marginTop: "2.5rem",
                    display: "flex",
                    justifyContent: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                }}>
                    {Array.from({ length: totalPages }, (_, i) => (
                        <button
                            key={i}
                            onClick={() => setPage(i + 1)}
                            style={{
                                padding: "0.6rem 1.1rem",
                                background: page === i + 1
                                    ? "linear-gradient(135deg, #705444 0%, #8b6b57 100%)"
                                    : "rgba(58, 44, 36, 0.5)",
                                color: page === i + 1 ? "#f8d9a6" : "#a07e65",
                                border: `2px solid ${page === i + 1 ? "#705444" : "rgba(112,84,68,0.3)"}`,
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontWeight: page === i + 1 ? 600 : 400,
                                fontSize: "1rem",
                                transition: "all 0.3s ease",
                                boxShadow: page === i + 1 ? "0 2px 8px rgba(112, 84, 68, 0.4)" : "none",
                            }}
                            onMouseEnter={(e) => {
                                if (page !== i + 1) {
                                    e.currentTarget.style.backgroundColor = "rgba(58, 44, 36, 0.8)";
                                    e.currentTarget.style.borderColor = "rgba(112,84,68,0.5)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (page !== i + 1) {
                                    e.currentTarget.style.backgroundColor = "rgba(58, 44, 36, 0.5)";
                                    e.currentTarget.style.borderColor = "rgba(112,84,68,0.3)";
                                }
                            }}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}