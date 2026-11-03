'use client';
import React, { useEffect, useState } from 'react';

type CommentItem = {
    _id: string;
    content: string;
    rating?: number;
    hidden?: boolean;
    userId: { _id?: string; username?: string; role?: string } | string | null;
    createdAt: string;
    parentCommentId?: string | null;
    replyToUsername?: string | null;
    likesCount?: number;
    dislikesCount?: number;
    userReaction?: 'like' | 'dislike' | null;
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

function stripHtml(input = '') {
    return input.replace(/<\/?[^>]+(>|$)/g, '');
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
    const [ratingDropdownOpen, setRatingDropdownOpen] = useState(false);
    const ratingDropdownRef = React.useRef<HTMLDivElement>(null);
    const [pendingReactions, setPendingReactions] = useState<Set<string>>(new Set());

    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';


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

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ratingDropdownRef.current && !ratingDropdownRef.current.contains(e.target as Node)) {
                setRatingDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchComments = async () => {
        if (!bookId) return;
        setLoading(true);
        try {
            const timestamp = new Date().getTime();
            const token = localStorage.getItem('readgrid_token');
            const res = await fetch(`/api/comments?bookId=${bookId}&t=${timestamp}`, {
                cache: "no-store",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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

    const refreshBookData = async () => {
        const timestamp = new Date().getTime();
        const bookRes = await fetch(`/api/books/${bookId}?t=${timestamp}`, { cache: 'no-store' });
        const updated = await bookRes.json();
        setBookData(updated);
    };

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
            } catch {
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
                await refreshBookData();
                await fetchComments();
            }, 500);

        } catch (err: any) {
            setMessage('Помилка мережі: ' + (err.message || 'Невідома помилка'));
        }
    };

    const handleSubmitReply = async (targetCommentId: string) => {
        setReplyMessage('');
        if (!isAuth) {
            setReplyMessage('Увійдіть, щоб відповісти');
            return;
        }

        const clean = stripHtml(replyText).trim();
        if (clean.length < 3) {
            setReplyMessage('Відповідь має бути мінімум 3 символи');
            return;
        }
        if (clean.length > 1000) {
            setReplyMessage('Відповідь занадто довга (максимум 1000)');
            return;
        }

        const token = localStorage.getItem('readgrid_token');
        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ bookId, commentText: clean, parentCommentId: targetCommentId }),
            });

            const data = await res.json();

            if (!res.ok) {
                setReplyMessage(data.message || 'Помилка при додаванні відповіді');
                return;
            }

            setReplyText('');
            setReplyingTo(null);
            await fetchComments();

        } catch (err: any) {
            setReplyMessage('Помилка мережі: ' + (err.message || 'Невідома помилка'));
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

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                console.error('Delete comment failed:', data);
                setMessage(`❌ ${data.message || 'Не вдалося видалити коментар'}`);
                return;
            }

            await fetchComments();
            await refreshBookData();
            setMessage('✅ Коментар видалено');
        } catch (err: any) {
            console.error(err);
            setMessage('❌ Помилка мережі при видаленні коментаря');
        }
    };

    const [togglingHidden, setTogglingHidden] = useState<Set<string>>(new Set());

    const handleToggleHidden = async (commentId: string, currentlyHidden: boolean) => {
        if (togglingHidden.has(commentId)) return;
        setTogglingHidden(prev => new Set(prev).add(commentId));

        const token = localStorage.getItem('readgrid_token');
        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ hidden: !currentlyHidden }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setMessage(`❌ ${data.message || 'Не вдалося змінити видимість коментаря'}`);
                return;
            }

            await fetchComments();
            setMessage(currentlyHidden ? '✅ Коментар знову видимий' : '✅ Коментар приховано');
        } catch (err: any) {
            console.error(err);
            setMessage('❌ Помилка мережі при зміні видимості коментаря');
        } finally {
            setTogglingHidden(prev => {
                const next = new Set(prev);
                next.delete(commentId);
                return next;
            });
        }
    };

    const handleReact = async (commentId: string, type: 'like' | 'dislike') => {
        if (!isAuth) {
            setMessage('Увійдіть, щоб оцінити коментар');
            return;
        }

        // Блокуємо повторний клік, поки попередній запит не завершився
        if (pendingReactions.has(commentId)) return;
        setPendingReactions(prev => new Set(prev).add(commentId));

        const token = localStorage.getItem('readgrid_token');

        setComments(prev => prev.map(c => {
            if (c._id !== commentId) return c;

            const prevReaction = c.userReaction || null;
            let likes = c.likesCount || 0;
            let dislikes = c.dislikesCount || 0;
            let newReaction: 'like' | 'dislike' | null = type;

            if (prevReaction === type) {
                newReaction = null;
                if (type === 'like') likes = Math.max(0, likes - 1);
                else dislikes = Math.max(0, dislikes - 1);
            } else {
                if (prevReaction === 'like') likes = Math.max(0, likes - 1);
                if (prevReaction === 'dislike') dislikes = Math.max(0, dislikes - 1);
                if (type === 'like') likes += 1;
                else dislikes += 1;
            }

            return { ...c, likesCount: likes, dislikesCount: dislikes, userReaction: newReaction };
        }));

        try {
            const res = await fetch(`/api/comments/${commentId}/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ type }),
            });

            if (!res.ok) {
                await fetchComments();
                return;
            }

            const data = await res.json();

            setComments(prev => prev.map(c =>
                c._id === commentId
                    ? { ...c, likesCount: data.likesCount, dislikesCount: data.dislikesCount, userReaction: data.userReaction }
                    : c
            ));
        } catch (err) {
            console.error('React error:', err);
            await fetchComments();
        } finally {
            // Розблоковуємо кнопку після завершення запиту
            setPendingReactions(prev => {
                const next = new Set(prev);
                next.delete(commentId);
                return next;
            });
        }
    };

    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest'); // 🆕

    useEffect(() => {
        setPage(1);
    }, [sortBy]);

    const commentsPerPage = 5;

    const rootComments = comments
        .filter(c => !c.parentCommentId)
        .sort((a, b) => {
            if (sortBy === 'popular') {
                // "Популярність" = лайки мінус дизлайки, за рівності — новіші вище
                const scoreA = (a.likesCount || 0) - (a.dislikesCount || 0);
                const scoreB = (b.likesCount || 0) - (b.dislikesCount || 0);
                if (scoreB !== scoreA) return scoreB - scoreA;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            // 'newest' — найновіші коментарі спочатку
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    const repliesByParent = new Map<string, CommentItem[]>();
    comments.forEach(c => {
        if (c.parentCommentId) {
            const list = repliesByParent.get(c.parentCommentId) || [];
            list.push(c);
            repliesByParent.set(c.parentCommentId, list);
        }
    });

    const paginatedRootComments = rootComments.slice(
        (page - 1) * commentsPerPage,
        page * commentsPerPage
    );

    const totalPages = Math.ceil(rootComments.length / commentsPerPage);

    const getUserName = (userId: CommentItem['userId']): string => {
        if (!userId) return '👻 Видалений користувач';
        if (typeof userId === 'object') {
            return userId.username || '👻 Видалений користувач';
        }
        return '👻 Видалений користувач';
    };

    const getAvatarInfo = (userId: CommentItem['userId']) => {
        if (!userId || typeof userId !== 'object' || !userId.username) {
            return { letter: '?', role: 'user' as const, isDeleted: true };
        }
    
        let role: 'user' | 'admin' | 'superadmin' = 'user';
        if (userId.role === 'superadmin') role = 'superadmin';
        else if (userId.role === 'admin') role = 'admin';
    
        return {
            letter: userId.username.charAt(0).toUpperCase(),
            role,
            isDeleted: false,
        };
    };

    const replyBtnStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: 'rgba(112,84,68,0.2)',
        color: '#e0c9a6',
        border: '1px solid rgba(112,84,68,0.45)',
        borderRadius: '20px',
        padding: '5px 14px',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.25s ease',
    };

    const cancelBtnStyle: React.CSSProperties = {
        ...replyBtnStyle,
        background: 'rgba(139,69,69,0.15)',
        color: '#e8a5a5',
        border: '1px solid rgba(139,69,69,0.4)',
    };

    const renderRootComment = (c: CommentItem) => {
        const userId = c.userId && typeof c.userId === 'object' ? c.userId._id : null;
        const commentAuthorRole = typeof c.userId === 'object' && c.userId !== null ? c.userId.role : undefined;

        const isCommentFromSuperAdmin = commentAuthorRole === 'superadmin';
        const isCommentFromAdmin = commentAuthorRole === 'admin';
        const isCommentFromRegularUser = !isCommentFromSuperAdmin && !isCommentFromAdmin;

        // SuperAdmin може видалити все. Admin може видалити ТІЛЬКИ звичайних користувачів. Користувач може видалити свій.
        const canDelete =
            currentUser &&
            (currentUser?.userId === userId ||
             currentUser?.role === 'superadmin' ||
             (currentUser?.role === 'admin' && isCommentFromRegularUser));

        // SuperAdmin може приховати все. Admin може приховати ТІЛЬКИ звичайних користувачів.
        const canHide =
            currentUser &&
            (currentUser?.role === 'superadmin' ||
             (currentUser?.role === 'admin' && isCommentFromRegularUser));

        const replies = (repliesByParent.get(c._id) || []).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        return (
            <div key={c._id}>
                {renderCommentCard(c, false, canDelete, canHide)}

                {replies.length > 0 && (
                    <div style={{ marginLeft: '2.2rem', display: 'grid', gap: '0.8rem', marginTop: '0.8rem' }}>
                        {replies.map(reply => {
                            const replyUserId = typeof reply.userId === 'object' && reply.userId !== null ? reply.userId._id : null;
                            const replyAuthorRole = typeof reply.userId === 'object' && reply.userId !== null ? reply.userId.role : undefined;
                            
                            const isReplyFromSuperAdmin = replyAuthorRole === 'superadmin';
                            const isReplyFromAdmin = replyAuthorRole === 'admin';
                            const isReplyFromRegularUser = !isReplyFromSuperAdmin && !isReplyFromAdmin;

                            const replyCanDelete =
                                currentUser &&
                                (currentUser?.userId === replyUserId ||
                                 currentUser?.role === 'superadmin' ||
                                 (currentUser?.role === 'admin' && isReplyFromRegularUser));

                            const replyCanHide =
                                currentUser &&
                                (currentUser?.role === 'superadmin' ||
                                 (currentUser?.role === 'admin' && isReplyFromRegularUser));

                            return renderCommentCard(reply, true, replyCanDelete, replyCanHide);
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderCommentCard = (c: CommentItem, isReply: boolean, canDelete: boolean | null, canHide: boolean | null) => {
        const avatar = getAvatarInfo(c.userId);
        const isLiked = c.userReaction === 'like';
        const isDisliked = c.userReaction === 'dislike';

        return (
            <div key={c._id} style={{
                padding: isReply ? "1.1rem 1.3rem" : "1.5rem",
                borderRadius: "12px",
                backgroundColor: isReply ? "rgba(27, 20, 17, 0.45)" : "rgba(27, 20, 17, 0.7)",
                border: isReply ? "1px solid rgba(112,84,68,0.2)" : "1px solid rgba(112,84,68,0.3)",
                boxShadow: isReply ? "none" : "0 2px 10px rgba(0,0,0,0.2)",
                transition: "all 0.3s ease",
            }}>
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                    paddingBottom: "0.75rem",
                    borderBottom: "1px solid rgba(112,84,68,0.2)",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{
                            width: isReply ? "32px" : "38px",
                            height: isReply ? "32px" : "38px",
                            borderRadius: "50%",
                            background: avatar.isDeleted
                                ? "rgba(112,84,68,0.25)"
                                : "radial-gradient(circle at 35% 30%, #6b4e38 0%, #4a3527 55%, #35261b 100%)",
                            border: avatar.role === 'superadmin' 
                                ? "2.5px solid #ffd700" 
                                : avatar.role === 'admin' 
                                    ? "2px solid #d4a23b" 
                                    : "2px solid #a3805f",
                            boxShadow: avatar.role === 'superadmin'
                                ? "0 0 15px rgba(255,215,0,0.6), inset 0 1px 3px rgba(0,0,0,0.3)"
                                : avatar.role === 'admin'
                                    ? "0 0 10px rgba(212,162,59,0.5), inset 0 1px 3px rgba(0,0,0,0.3)"
                                    : "inset 0 1px 3px rgba(0,0,0,0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: isReply ? "0.85rem" : "1rem",
                            fontWeight: 700,
                            color: "#fdeecb",
                            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                            flexShrink: 0,
                        }}>
                            {avatar.isDeleted ? '👻' : avatar.letter}
                        </div>
                        <strong style={{
                            color: c.userId ? "#f8d9a6" : "#a07e65",
                            fontSize: isReply ? "0.95rem" : "1.05rem",
                            fontStyle: c.userId ? 'normal' : 'italic'
                        }}>
                            {getUserName(c.userId)}
                        </strong>
                        {avatar.role === 'superadmin' && (
                            <span style={{
                                padding: '2px 10px',
                                borderRadius: '20px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                letterSpacing: '0.4px',
                                textTransform: 'uppercase',
                                color: '#ffd700',
                                background: 'rgba(255,215,0,0.15)',
                                border: '1px solid rgba(255,215,0,0.35)',
                                boxShadow: '0 0 8px rgba(255,215,0,0.3)',
                            }}>
                                👑 СУПЕРАДМІН
                            </span>
                        )}

                        {avatar.role === 'admin' && (
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
                                ⚡ АДМІН
                            </span>
                        )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ color: "#a07e65", fontSize: "0.85rem" }}>
                            📅 {new Date(c.createdAt).toLocaleDateString('uk-UA')}
                        </span>
                        
                        {/* Кнопка видалення */}
                        {canDelete && (
                            <button
                                onClick={() => handleDelete(c._id)}
                                style={{
                                    background: "rgba(255, 99, 99, 0.1)",
                                    color: "#ff9999",
                                    border: "1px solid rgba(255, 99, 99, 0.3)",
                                    borderRadius: "6px",
                                    padding: "0.35rem 0.7rem",
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    transition: "all 0.3s ease",
                                }}
                                title="Видалити коментар"
                            >
                                🗑️ Видалити
                            </button>
                        )}

                        {/* Кнопка приховування — тепер використовує canHide */}
                        {canHide && (
                            <button
                                onClick={() => handleToggleHidden(c._id, !!c.hidden)}
                                disabled={togglingHidden.has(c._id)}
                                style={{
                                    background: c.hidden ? "rgba(76,138,82,0.15)" : "rgba(212,162,59,0.12)",
                                    color: c.hidden ? "#8fd98f" : "#d4a23b",
                                    border: `1px solid ${c.hidden ? 'rgba(76,138,82,0.35)' : 'rgba(212,162,59,0.3)'}`,
                                    borderRadius: "6px",
                                    padding: "0.35rem 0.7rem",
                                    cursor: togglingHidden.has(c._id) ? "not-allowed" : "pointer",
                                    fontSize: "0.85rem",
                                    transition: "all 0.3s ease",
                                }}
                                title={c.hidden ? 'Показати коментар усім' : 'Приховати коментар від читачів'}
                            >
                                {c.hidden ? '👁️ Показати' : '🙈 Приховати'}
                            </button>
                        )}
                    </div>
                </div>

                {c.replyToUsername && (
                    <div style={{
                        display: 'inline-block',
                        color: '#c9a575',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        marginBottom: '0.5rem',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        background: 'rgba(112,84,68,0.15)',
                    }}>
                        @{c.replyToUsername}
                    </div>
                )}

                {c.hidden && isAdmin && (
                    <div style={{
                        display: 'inline-block',
                        color: '#d4a23b',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        marginBottom: '0.5rem',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        background: 'rgba(212,162,59,0.12)',
                        border: '1px solid rgba(212,162,59,0.3)',
                    }}>
                        🙈 Прихований від читачів
                    </div>
                )}

                <div style={{
                    color: "#d8c3a5",
                    fontSize: isReply ? "0.95rem" : "1rem",
                    lineHeight: "1.6",
                    marginBottom: c.rating ? "1rem" : "0.7rem",
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
                        marginBottom: "0.7rem",
                    }}>
                        <span style={{ color: "#ffd966", fontSize: "1.2rem", fontWeight: 600 }}>
                            {"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}
                        </span>
                        <span style={{ color: "#a07e65", fontSize: "0.9rem", marginLeft: "0.5rem" }}>
                            ({c.rating}/5)
                        </span>
                    </div>
                )}

                {/* Лайк / Дизлайк + Відповісти в одному ряду */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => handleReact(c._id, 'like')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: isLiked ? 'rgba(76,138,82,0.25)' : 'rgba(255,255,255,0.05)',
                            color: isLiked ? '#8fd98f' : '#c9a575',
                            border: `1px solid ${isLiked ? 'rgba(76,138,82,0.5)' : 'rgba(112,84,68,0.3)'}`,
                            borderRadius: '20px',
                            padding: '5px 12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                        title="Подобається"
                    >
                        👍 {c.likesCount || 0}
                    </button>

                    <button
                        onClick={() => handleReact(c._id, 'dislike')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: isDisliked ? 'rgba(139,69,69,0.25)' : 'rgba(255,255,255,0.05)',
                            color: isDisliked ? '#e8a5a5' : '#c9a575',
                            border: `1px solid ${isDisliked ? 'rgba(139,69,69,0.5)' : 'rgba(112,84,68,0.3)'}`,
                            borderRadius: '20px',
                            padding: '5px 12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                        title="Не подобається"
                    >
                        👎 {c.dislikesCount || 0}
                    </button>

                    {isAuth && (
                        <button
                            onClick={() => {
                                setReplyingTo(replyingTo === c._id ? null : c._id);
                                setReplyText('');
                                setReplyMessage('');
                            }}
                            style={replyingTo === c._id ? cancelBtnStyle : replyBtnStyle}
                        >
                            {replyingTo === c._id ? '✖️ Скасувати' : '↩️ Відповісти'}
                        </button>
                    )}
                </div>

                {replyingTo === c._id && (
                    <div style={{ marginTop: '0.9rem' }}>
                        <textarea
                            rows={3}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Відповісти ${getUserName(c.userId)}...`}
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                border: "2px solid rgba(112,84,68,0.3)",
                                background: "rgba(46, 38, 33, 0.8)",
                                color: "#f8d9a6",
                                fontSize: "0.95rem",
                                resize: "vertical",
                                outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                            <button
                                onClick={() => handleSubmitReply(c._id)}
                                style={{
                                    ...replyBtnStyle,
                                    background: 'linear-gradient(135deg, #705444 0%, #8b6b57 100%)',
                                    color: '#f8d9a6',
                                    border: 'none',
                                    padding: '7px 16px',
                                }}
                            >
                                📤 Надіслати
                            </button>
                            {replyMessage && (
                                <span style={{ color: "#ff9999", fontSize: "0.85rem" }}>{replyMessage}</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            marginTop: "3rem",
            padding: "0",
            maxWidth: "1100px",
            marginLeft: "auto",
            marginRight: "auto",
        }}>
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
                                <div ref={ratingDropdownRef} style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setRatingDropdownOpen(!ratingDropdownOpen)}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: 'linear-gradient(180deg, #3a2c24 0%, #2e2118 100%)',
                                            color: rating === '' ? '#c9a575' : '#f8d9a6',
                                            border: `1.5px solid ${ratingDropdownOpen ? '#d4a23b' : 'rgba(212,162,59,0.25)'}`,
                                            borderRadius: '10px',
                                            padding: '0.8rem 1.1rem',
                                            fontSize: '1.02rem',
                                            fontFamily: 'Merriweather, serif',
                                            boxShadow: ratingDropdownOpen
                                                ? '0 0 0 3px rgba(212,162,59,0.15), 0 4px 14px rgba(0,0,0,0.3)'
                                                : '0 2px 8px rgba(0,0,0,0.25)',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s ease',
                                        }}
                                    >
                                        <span>
                                            {rating === '' ? '⭐ Оберіть оцінку (опціонально)' : {
                                                1: '★☆☆☆☆ Жахливо (1)',
                                                2: '★★☆☆☆ Погано (2)',
                                                3: '★★★☆☆ Нормально (3)',
                                                4: '★★★★☆ Добре (4)',
                                                5: '★★★★★ Чудово (5)',
                                            }[rating]}
                                        </span>
                                        <span style={{
                                            transition: 'transform 0.25s ease, color 0.25s ease',
                                            transform: ratingDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                            color: ratingDropdownOpen ? '#d4a23b' : '#a3805f',
                                            fontSize: '0.85rem',
                                        }}>
                                            ▾
                                        </span>
                                    </button>

                                    {ratingDropdownOpen && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 8px)',
                                            left: 0,
                                            right: 0,
                                            background: 'linear-gradient(180deg, #322419 0%, #241a12 100%)',
                                            border: '1.5px solid rgba(212,162,59,0.3)',
                                            borderRadius: '12px',
                                            boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
                                            overflow: 'hidden',
                                            zIndex: 20,
                                            padding: '6px',
                                        }}>
                                            {[
                                                { value: '', label: '⭐ Оберіть оцінку (опціонально)' },
                                                { value: 1, label: '★☆☆☆☆ Жахливо (1)' },
                                                { value: 2, label: '★★☆☆☆ Погано (2)' },
                                                { value: 3, label: '★★★☆☆ Нормально (3)' },
                                                { value: 4, label: '★★★★☆ Добре (4)' },
                                                { value: 5, label: '★★★★★ Чудово (5)' },
                                            ].map((opt) => {
                                                const isSelected = rating === opt.value;
                                                return (
                                                    <div
                                                        key={String(opt.value)}
                                                        onClick={() => {
                                                            setRating(opt.value === '' ? '' : Number(opt.value));
                                                            setRatingDropdownOpen(false);
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '0.65rem 0.9rem',
                                                            fontSize: '0.98rem',
                                                            borderRadius: '8px',
                                                            color: isSelected ? '#2a1e12' : '#e0c9a6',
                                                            background: isSelected
                                                                ? 'linear-gradient(135deg, #d4a23b 0%, #f4d03f 100%)'
                                                                : 'transparent',
                                                            fontWeight: isSelected ? 700 : 400,
                                                            cursor: 'pointer',
                                                            transition: 'background-color 0.15s ease',
                                                            marginBottom: '2px',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(212,162,59,0.12)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                                        }}
                                                    >
                                                        <span>{opt.label}</span>
                                                        {isSelected && <span style={{ color: '#2a1e12', fontWeight: 900 }}>✓</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
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

            <div>
                <h4 style={{
                    color: "#f8d9a6",
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    marginBottom: "1rem",
                    textAlign: "center",
                    textShadow: "0 0 6px rgba(248,217,166,0.3)",
                    letterSpacing: "0.5px",
                }}>
                    💭 Коментарі читачів ({comments.length})
                </h4>

                {rootComments.length > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginBottom: '1.8rem' }}>
                        {[
                            { key: 'newest' as const, label: '🕐 Найновіші' },
                            { key: 'popular' as const, label: '🔥 Найпопулярніші' },
                        ].map(opt => {
                            const isActive = sortBy === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    onClick={() => setSortBy(opt.key)}
                                    style={{
                                        padding: '0.45rem 1.1rem',
                                        borderRadius: '20px',
                                        border: isActive ? '1px solid #d4a23b' : '1px solid rgba(112,84,68,0.35)',
                                        background: isActive
                                            ? 'linear-gradient(135deg, rgba(212,162,59,0.25) 0%, rgba(244,208,63,0.14) 100%)'
                                            : 'rgba(112,84,68,0.12)',
                                        color: isActive ? '#f8d9a6' : '#c9a575',
                                        fontWeight: isActive ? 700 : 500,
                                        fontSize: '0.88rem',
                                        fontFamily: 'Merriweather, serif',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {loading ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "#a07e65", fontSize: "1.1rem" }}>
                        ⏳ Завантаження...
                    </div>
                ) : rootComments.length === 0 ? (
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
                        {paginatedRootComments.map((c) => renderRootComment(c))}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div style={{ marginTop: "2.5rem", display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
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