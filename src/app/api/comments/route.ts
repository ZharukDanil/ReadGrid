import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import '@/models/User';
import Book from '@/models/Book';
import Rating from '@/models/Rating';
import Comment from '@/models/Comment';
import CommentReaction from '@/models/CommentReaction'; // 🆕
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const BANNED_WORDS = ['badword1', 'badword2', 'fuck', 'shit'];

function stripHtml(input = '') {
  return input.replace(/<\/?[^>]+(>|$)/g, '');
}

function containsBannedWord(text: string) {
  const t = text.toLowerCase();
  return BANNED_WORDS.some(w => t.includes(w));
}

export async function GET(req: Request) {
  try {
    await dbConnect();

    const url = new URL(req.url);
    const bookId = url.searchParams.get('bookId');
    if (!bookId) {
      return NextResponse.json({ message: 'Missing bookId' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return NextResponse.json({ message: 'Invalid bookId' }, { status: 400 });
    }

    // 🆕 Визначаємо, чи запит від адміністратора — йому показуємо
    // приховані коментарі теж (з позначкою), звичайним читачам — ні
    let requesterIsAdmin = false;
    const authHeaderPre = req.headers.get('authorization') || '';
    const tokenPre = authHeaderPre.replace(/^Bearer\s+/i, '').trim();
    if (tokenPre) {
      const payloadPre: any = verifyToken(tokenPre);
      if (payloadPre?.role === 'admin' || payloadPre?.role === 'superadmin') requesterIsAdmin = true;
    }

    const commentFilter: any = { bookId };
    if (!requesterIsAdmin) {
      commentFilter.hidden = { $ne: true };
    }

    const comments = await Comment.find(commentFilter)
      .sort({ createdAt: 1 })
      .populate('userId', 'username role')
      .lean();

    const commentIds = comments.map((c: any) => c._id);

    const reactionAgg = await CommentReaction.aggregate([
      { $match: { commentId: { $in: commentIds } } },
      { $group: { _id: { commentId: '$commentId', type: '$type' }, count: { $sum: 1 } } },
    ]);

    const countsMap = new Map<string, { likes: number; dislikes: number }>();
    reactionAgg.forEach((r: any) => {
      const cid = r._id.commentId.toString();
      const entry = countsMap.get(cid) || { likes: 0, dislikes: 0 };
      if (r._id.type === 'like') entry.likes = r.count;
      else entry.dislikes = r.count;
      countsMap.set(cid, entry);
    });

    let currentUserId: string | null = null;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const payload: any = verifyToken(token);
      if (payload?.userId) currentUserId = payload.userId;
    }

    const myReactionsMap = new Map<string, 'like' | 'dislike'>();
    if (currentUserId) {
      const myReactions = await CommentReaction.find({
        commentId: { $in: commentIds },
        userId: currentUserId,
      }).lean();
      myReactions.forEach((r: any) => {
        myReactionsMap.set(r.commentId.toString(), r.type);
      });
    }

    const enrichedComments = comments.map((c: any) => {
      const counts = countsMap.get(c._id.toString()) || { likes: 0, dislikes: 0 };
      return {
        ...c,
        likesCount: counts.likes,
        dislikesCount: counts.dislikes,
        userReaction: myReactionsMap.get(c._id.toString()) || null,
      };
    });

    return NextResponse.json({ comments: enrichedComments }, { status: 200 });
  } catch (err: any) {
    console.error('GET /api/comments error:', err);
    return NextResponse.json({ message: 'Database error', error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();

        // 🆕 Rate limiting: не більше 10 коментарів за хвилину з одного IP
        const ip = getClientIp(req);
        const { allowed, retryAfterMs } = rateLimit(`comment:${ip}`, 10, 60_000);
        if (!allowed) {
          return NextResponse.json(
            { message: `Забагато запитів. Спробуйте через ${Math.ceil(retryAfterMs / 1000)} сек.` },
            { status: 429 }
          );
        }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { bookId, commentText, rating, parentCommentId } = await req.json();

    if (!bookId || !commentText) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return NextResponse.json({ message: "Invalid bookId" }, { status: 400 });
    }

    let finalParentId: mongoose.Types.ObjectId | null = null;
    let replyToUsername: string | null = null;

    if (parentCommentId) {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
        return NextResponse.json({ message: "Invalid parentCommentId" }, { status: 400 });
      }

      const targetComment: any = await Comment.findById(parentCommentId).populate('userId', 'username');
      if (!targetComment || targetComment.bookId.toString() !== bookId) {
        return NextResponse.json({ message: "Parent comment not found" }, { status: 404 });
      }

      if (targetComment.parentCommentId) {
        finalParentId = targetComment.parentCommentId;
        replyToUsername = targetComment.userId?.username || null;
      } else {
        finalParentId = targetComment._id;
        replyToUsername = null;
      }
    }

    const clean = stripHtml(String(commentText)).trim();

    if (clean.length < 3 || clean.length > 1000) {
      return NextResponse.json({ message: "Invalid comment length (3-1000 chars)" }, { status: 400 });
    }

    if (containsBannedWord(clean)) {
      return NextResponse.json({ message: "Forbidden words detected" }, { status: 400 });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return NextResponse.json({ message: "Book not found" }, { status: 404 });
    }

    let ratingValue: number | undefined;

    if (!finalParentId) {
      const existingRating = await Rating.findOne({ bookId, userId: payload.userId });

      if (rating !== undefined && rating !== null && rating !== "") {
        if (existingRating) {
          console.log('⚠️ User already rated this book, ignoring new rating');
        } else {
          const r = Number(rating);
          if (Number.isNaN(r) || r < 1 || r > 5) {
            return NextResponse.json({ message: "Invalid rating (1-5)" }, { status: 400 });
          }

          ratingValue = Math.round(r);

          await Rating.create({
            userId: payload.userId,
            bookId: bookId,
            value: ratingValue
          });

          const agg = await Rating.aggregate([
            { $match: { bookId: new mongoose.Types.ObjectId(bookId) } },
            { $group: { _id: "$bookId", avg: { $avg: "$value" }, count: { $sum: 1 } } },
          ]);

          const avg = agg[0]?.avg ?? 0;
          const count = agg[0]?.count ?? 0;

          await Book.findByIdAndUpdate(bookId, {
            $set: { avgRating: Math.round(avg * 100) / 100, ratingsCount: count },
          });
        }
      }
    }

    const commentData: any = {
      userId: new mongoose.Types.ObjectId(payload.userId),
      bookId: new mongoose.Types.ObjectId(bookId),
      content: clean,
      hidden: false,
      parentCommentId: finalParentId,
      replyToUsername: replyToUsername,
    };

    if (ratingValue !== undefined) {
      commentData.rating = ratingValue;
    }

    const newComment = await Comment.create(commentData);

    const populatedComment = await Comment.findById(newComment._id)
      .populate('userId', 'username role')
      .lean();

    return NextResponse.json(
      { message: "Comment added", comment: populatedComment },
      { status: 201 }
    );

  } catch (err: any) {
    console.error('POST /api/comments error:', err);
    return NextResponse.json({
      message: "Server error",
      error: err.message
    }, { status: 500 });
  }
}