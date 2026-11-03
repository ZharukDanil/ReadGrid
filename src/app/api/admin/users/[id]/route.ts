import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    // Дозволено тільки admin або superadmin
    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    // Захист від самопошкодження
    if (id === payload.userId) {
      return NextResponse.json({ message: 'Ви не можете змінити власний обліковий запис тут' }, { status: 403 });
    }

    // Перевіряємо цільового користувача
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ message: 'Користувача не знайдено' }, { status: 404 });
    }

    const body = await req.json();
    const update: any = {};

    // Перевірка прав для зміни РОЛІ — тільки SuperAdmin
    if (typeof body.role === 'string') {
      // Тільки SuperAdmin може змінювати ролі
      if (payload.role !== 'superadmin') {
          return NextResponse.json({
              message: 'Тільки Суперадмін може змінювати ролі користувачів.',
          }, { status: 403 });
      }

      if (!['user', 'admin', 'superadmin'].includes(body.role)) {
          return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
      }

      // Тільки superadmin може призначати superadmin
      if (body.role === 'superadmin' && payload.role !== 'superadmin') {
          return NextResponse.json({ message: 'Тільки суперадмін може призначати суперадмінів' }, { status: 403 });
      }

      update.role = body.role;
  }

    // Перевірка прав для БЛОКУВАННЯ
    if (typeof body.isBlocked === 'boolean') {
      // Звичайний admin не може блокувати admin/superadmin
      if (payload.role === 'admin' && (targetUser.role === 'admin' || targetUser.role === 'superadmin')) {
        return NextResponse.json({
          message: 'Звичайний адмін не може блокувати інших адмінів або суперадмінів.',
        }, { status: 403 });
      }
      update.isBlocked = body.isBlocked;
    }

    // Premium можна змінювати ВСІМ адмінам для ВСІХ користувачів (включаючи інших адмінів)
    if (typeof body.isPremium === 'boolean') {
      update.isPremium = body.isPremium;
      // Немає додаткових перевірок - Premium це не безпека, а привілей
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }

    const updated = await User.findByIdAndUpdate(id, { $set: update }, { new: true, select: '-password' });

    if (!updated) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User updated', user: updated }, { status: 200 });
  } catch (error: any) {
    console.error('PATCH /api/admin/users/[id] error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}