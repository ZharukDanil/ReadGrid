// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import Comment from '@/models/Comment';
import CommentReaction from '@/models/CommentReaction';
import Rating from '@/models/Rating';
import Book from '@/models/Book';
import bcrypt from 'bcryptjs';
import { verifyToken, signToken } from '@/lib/jwt';
import validator from 'validator';
import { checkPremiumExpiry } from '@/lib/checkPremiumExpiry';
import mongoose from 'mongoose';

function getTokenUserId(decoded: any): string | null {
  if (!decoded) return null;
  return decoded.userId || decoded.id || decoded._id || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ message: 'Missing token' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const decoded: any = verifyToken(token);
    if (!decoded) return NextResponse.json({ message: 'Invalid token' }, { status: 403 });

    const { id } = await params;

    const tokenUserId = getTokenUserId(decoded);
    if (!tokenUserId || tokenUserId !== id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await checkPremiumExpiry(id);

    const user = await User.findById(id).select('-password -__v');
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    return NextResponse.json(user);
  } catch (err) {
    console.error('GET /api/users/[id] error:', err);
    return NextResponse.json({ message: 'Database connection error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ message: 'Missing token' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const decoded: any = verifyToken(token);
    if (!decoded) return NextResponse.json({ message: 'Invalid token' }, { status: 403 });

    const { id } = await params;

    const tokenUserId = getTokenUserId(decoded);
    if (!tokenUserId || tokenUserId !== id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { username, email, password, currentPassword } = body;

    const updates: any = {};

    if (username !== undefined) {
      if (!username || username.length < 3)
        return NextResponse.json({ message: 'Username too short' }, { status: 400 });
      updates.username = username;
    }

    if (email !== undefined) {
      if (!validator.isEmail(email))
        return NextResponse.json({ message: 'Invalid email format' }, { status: 400 });
      updates.email = email.toLowerCase();
    }

    if (password !== undefined && password !== '') {
      if (!currentPassword) {
        return NextResponse.json({ message: 'Для зміни пароля необхідно ввести поточний пароль' }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json({ message: 'Пароль занадто короткий (мін. 6 символів)' }, { status: 400 });
      }
      
      const user = await User.findById(id);
      if (!user) {
        return NextResponse.json({ message: 'Користувача не знайдено' }, { status: 404 });
      }

      const passwordMatches = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatches) {
        return NextResponse.json({ message: 'Невірний поточний пароль' }, { status: 403 });
      }

      updates.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password -__v');
    if (!updatedUser) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    const newToken = signToken({
      userId: String(updatedUser._id),
      username: updatedUser.username,
      role: updatedUser.role,
      email: updatedUser.email,
    });

    return NextResponse.json({
      message: 'Profile successfully updated',
      user: updatedUser,
      token: newToken
    });
  } catch (err) {
    console.error('PUT /api/users/[id] error:', err);
    return NextResponse.json({ message: 'Database connection error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ message: 'Missing token' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const decoded: any = verifyToken(token);
    if (!decoded) return NextResponse.json({ message: 'Invalid token' }, { status: 403 });

    const { id } = await params;

    // Видалити можна лише власний акаунт — не чужий, навіть якщо ти admin/superadmin
    const tokenUserId = getTokenUserId(decoded);
    if (!tokenUserId || tokenUserId !== id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ message: 'Введіть пароль для підтвердження' }, { status: 400 });
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return NextResponse.json({ message: 'Невірний пароль' }, { status: 403 });
    }

    // Захист: не даємо видалити останнього суперадміна на платформі
    if (user.role === 'superadmin') {
      const superadminCount = await User.countDocuments({ role: 'superadmin' });
      if (superadminCount <= 1) {
        return NextResponse.json(
          { message: 'Неможливо видалити єдиного суперадміна платформи' },
          { status: 403 }
        );
      }
    }

    // 1. Знаходимо всі власні коментарі користувача (і кореневі, і відповіді)
    const ownComments = await Comment.find({ userId: id }, '_id');
    const ownCommentIds = ownComments.map((c: any) => c._id);

    // 2. Знаходимо "осиротілі" відповіді — коментарі ІНШИХ користувачів,
    // які відповідали саме на кореневі коментарі цього користувача.
    // Без цього вони лишились би висіти з посиланням на видалений коментар.
    const childComments = await Comment.find(
      { parentCommentId: { $in: ownCommentIds } },
      '_id'
    );
    const childCommentIds = childComments.map((c: any) => c._id);

    const allCommentIdsToDelete = [...ownCommentIds, ...childCommentIds];

    // 3. Власні оцінки (Rating) — треба запам'ятати bookId ДО видалення,
    // щоб потім перерахувати avgRating/ratingsCount цих книг
    const ownRatings = await Rating.find({ userId: id }, 'bookId');
    const affectedBookIds = [...new Set(ownRatings.map((r: any) => r.bookId.toString()))];

    // 4. Видаляємо все пов'язане, у порядку від дрібного до великого
    await CommentReaction.deleteMany({
      $or: [{ userId: id }, { commentId: { $in: allCommentIdsToDelete } }],
    });
    await Comment.deleteMany({ _id: { $in: allCommentIdsToDelete } });
    await Rating.deleteMany({ userId: id });

    // 5. Перераховуємо рейтинг книг, які втратили оцінку цього користувача
    for (const bookId of affectedBookIds) {
      const agg = await Rating.aggregate([
        { $match: { bookId: new mongoose.Types.ObjectId(bookId) } },
        { $group: { _id: '$bookId', avg: { $avg: '$value' }, count: { $sum: 1 } } },
      ]);

      const avg = agg[0]?.avg ?? 0;
      const count = agg[0]?.count ?? 0;

      await Book.findByIdAndUpdate(bookId, {
        $set: {
          avgRating: count > 0 ? Math.round(avg * 100) / 100 : 0,
          ratingsCount: count,
        },
      });
    }

    // 6. Нарешті сам акаунт (favorites видаляються автоматично разом з документом)
    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Акаунт та всі пов’язані дані видалено' }, { status: 200 });
  } catch (err: any) {
    console.error('DELETE /api/users/[id] error:', err);
    return NextResponse.json({ message: 'Database connection error' }, { status: 500 });
  }
}