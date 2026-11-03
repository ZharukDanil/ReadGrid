import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import '@/models/User';
import Book from '@/models/Book';
import Rating from '@/models/Rating';
import Comment from '@/models/Comment';
import CommentReaction from '@/models/CommentReaction'; // 🆕
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid comment id" }, { status: 400 });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return NextResponse.json({ message: "Comment not found" }, { status: 404 });
    }

    const isOwner = comment.userId.toString() === payload.userId;
    const isAdmin = payload.role === "admin" || payload.role === "superadmin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: "No permission to delete" }, { status: 403 });
    }

    const bookId = comment.bookId;

    const children = await Comment.find({ parentCommentId: comment._id }, '_id');
    const allIdsToDelete = [comment._id, ...children.map((c: any) => c._id)];

    const commentsWithRating = await Comment.find({
      _id: { $in: allIdsToDelete },
      rating: { $exists: true, $ne: null },
    });

    await Comment.deleteMany({ _id: { $in: allIdsToDelete } });
    await CommentReaction.deleteMany({ commentId: { $in: allIdsToDelete } }); // 🆕

    for (const c of commentsWithRating) {
      await Rating.deleteOne({ userId: c.userId, bookId: c.bookId });
    }

    const ratingAgg = await Rating.aggregate([
      { $match: { bookId: new mongoose.Types.ObjectId(bookId.toString()) } },
      { $group: { _id: "$bookId", avg: { $avg: "$value" }, count: { $sum: 1 } } },
    ]);

    const avg = ratingAgg[0]?.avg ?? 0;
    const count = ratingAgg[0]?.count ?? 0;

    await Book.findByIdAndUpdate(bookId, {
      $set: {
        avgRating: count > 0 ? Math.round(avg * 100) / 100 : 0,
        ratingsCount: count,
      },
    });

    return NextResponse.json({ message: "Comment deleted", deletedCount: allIdsToDelete.length }, { status: 200 });

  } catch (err: any) {
    console.error('DELETE /api/comments/[id] error:', err);
    return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid comment id' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const body = await req.json();
    const { hidden } = body ?? {};

    if (typeof hidden !== 'boolean') {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }

    const updated = await Comment.findByIdAndUpdate(
      id,
      { $set: { hidden } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ message: 'Comment not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: hidden ? 'Comment hidden' : 'Comment visible',
      comment: updated
    }, { status: 200 });

  } catch (err: any) {
    console.error('PATCH /api/comments/[id] error:', err);
    return NextResponse.json({ message: 'Server error', error: err.message }, { status: 500 });
  }
}