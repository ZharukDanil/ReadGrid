import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import Comment from '@/models/Comment';
import CommentReaction from '@/models/CommentReaction';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

        // Rate limiting: не більше 30 реакцій за хвилину з одного IP
        const ip = getClientIp(req);
        const { allowed, retryAfterMs } = rateLimit(`react:${ip}`, 30, 60_000);
        if (!allowed) {
          return NextResponse.json(
            { message: `Забагато запитів. Спробуйте через ${Math.ceil(retryAfterMs / 1000)} сек.` },
            { status: 429 }
          );
        }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid comment id' }, { status: 400 });
    }

    const { type } = await req.json();
    if (type !== 'like' && type !== 'dislike') {
      return NextResponse.json({ message: 'Invalid reaction type' }, { status: 400 });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return NextResponse.json({ message: 'Comment not found' }, { status: 404 });
    }

    const prevDoc = await CommentReaction.findOneAndUpdate(
      { commentId: id, userId: payload.userId },
      { $set: { type }, $setOnInsert: { commentId: id, userId: payload.userId } },
      { upsert: true, new: false }
    );

    let userReaction: 'like' | 'dislike' | null = type;

    if (prevDoc && prevDoc.type === type) {
      
      await CommentReaction.deleteOne({ commentId: id, userId: payload.userId });
      userReaction = null;
    }

    const [likesCount, dislikesCount] = await Promise.all([
      CommentReaction.countDocuments({ commentId: id, type: 'like' }),
      CommentReaction.countDocuments({ commentId: id, type: 'dislike' }),
    ]);

    return NextResponse.json({ likesCount, dislikesCount, userReaction }, { status: 200 });
  } catch (err: any) {
    console.error('POST /api/comments/[id]/react error:', err);

    // Підстраховка: якщо все ж стався E11000,
    // не валимо запит з 500 — рахуємо поточний стан і повертаємо його чесно
    if (err.code === 11000) {
      try {
        const { id } = await params;
        const existing = await CommentReaction.findOne({ commentId: id });
        const [likesCount, dislikesCount] = await Promise.all([
          CommentReaction.countDocuments({ commentId: id, type: 'like' }),
          CommentReaction.countDocuments({ commentId: id, type: 'dislike' }),
        ]);
        return NextResponse.json({ likesCount, dislikesCount, userReaction: existing?.type || null }, { status: 200 });
      } catch {
        // якщо і це не вдалось — падаємо у загальну помилку нижче
      }
    }

    return NextResponse.json({ message: 'Server error', error: err.message }, { status: 500 });
  }
}