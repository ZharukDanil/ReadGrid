// src/app/api/favorites/route.ts
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import { verifyToken } from '@/lib/jwt';
import User from '@/models/User';
import Book from '@/models/Book';

// GET - отримати всі обрані книги користувача
export async function GET(req: Request) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(payload.userId).populate({
      path: 'favorites',
      select: '-fileUrl',
    });
    
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ favorites: user.favorites || [] }, { status: 200 });
  } catch (error: any) {
    console.error('Get favorites error:', error);
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

// POST - додати книгу в обране
export async function POST(req: Request) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await req.json();

    if (!bookId) {
      return NextResponse.json({ message: 'Book ID required' }, { status: 400 });
    }

    // Перевірка чи існує книга
    const book = await Book.findById(bookId);
    if (!book) {
      return NextResponse.json({ message: 'Book not found' }, { status: 404 });
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Перевірка чи вже є в обраному
    if (user.favorites.includes(bookId)) {
      return NextResponse.json({ message: 'Book already in favorites' }, { status: 409 });
    }

    // Додаємо в обране
    user.favorites.push(bookId);
    await user.save();

    return NextResponse.json({ message: 'Added to favorites', favorites: user.favorites }, { status: 200 });
  } catch (error: any) {
    console.error('Add to favorites error:', error);
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

// DELETE - видалити книгу з обраного
export async function DELETE(req: Request) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId');

    if (!bookId) {
      return NextResponse.json({ message: 'Book ID required' }, { status: 400 });
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Видаляємо з обраного
    user.favorites = user.favorites.filter((id: any) => id.toString() !== bookId);
    await user.save();

    return NextResponse.json({ message: 'Removed from favorites', favorites: user.favorites }, { status: 200 });
  } catch (error: any) {
    console.error('Remove from favorites error:', error);
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}