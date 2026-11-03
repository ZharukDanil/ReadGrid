// src/app/api/books/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import Book from '@/models/Book';
import { verifyToken } from '@/lib/jwt';

// GET - отримати книги з пагінацією та фільтрами (виконується на рівні бази даних)
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '6', 10)));
    const search = (searchParams.get('search') || '').trim();
    const genre = (searchParams.get('genre') || '').trim();
    const year = (searchParams.get('year') || '').trim();

    const query: any = {};

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: searchRegex }, { author: searchRegex }];
    }

    if (genre) {
      const genreRegex = new RegExp(genre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.genre = genreRegex;
    }

    if (year) {
      const yearNum = Number(year);
      if (!Number.isNaN(yearNum)) {
        query.year = yearNum;
      }
    }

    const totalBooks = await Book.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalBooks / limit));

    // 🆕 .select('-fileUrl') — та сама причина, що й у /api/books/[id]:
    // список книг публічний, і посилання на файл не повинно туди потрапляти
    const books = await Book.find(query)
      .select('-fileUrl -filePublicId')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json(
      { books, totalBooks, totalPages, currentPage: page },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

// POST - додати нову книгу (тільки admin) — без змін
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const body = await req.json();
    const { title, author, genre, year, description, coverUrl, fileUrl, filePublicId, isPremium } = body;

    if (!title || !author || !genre || !year || !description || !coverUrl || (!fileUrl && !filePublicId)) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();
    if (typeof year !== 'number' || year < 1500 || year > currentYear) {
      return NextResponse.json({
        message: `Invalid year. Must be between 1500 and ${currentYear}`
      }, { status: 400 });
    }

    const urlRegex = /^https?:\/\/.+/i;
    if (!urlRegex.test(coverUrl) || (fileUrl && !urlRegex.test(fileUrl))) {
      return NextResponse.json({ message: 'Invalid file URL' }, { status: 400 });
    }
    if (filePublicId && !String(filePublicId).startsWith('readgrid/books/')) {
      return NextResponse.json({ message: 'Invalid file id' }, { status: 400 });
    }

    const existingBook = await Book.findOne({ title, author });
    if (existingBook) {
      return NextResponse.json({
        message: 'Book with this title and author already exists'
      }, { status: 409 });
    }

    const newBook = new Book({
      title,
      author,
      genre,
      year,
      description,
      coverUrl,
      ...(filePublicId ? { filePublicId } : { fileUrl }),
      isPremium: !!isPremium,
    });

    await newBook.save();

    // не возвращаем ссылку на файл в ответе
    const { fileUrl: _f, filePublicId: _p, ...safeBook } = newBook.toObject();

    return NextResponse.json({
      message: 'Book successfully added',
      book: safeBook
    }, { status: 201 });

  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({
        message: 'Book with this title and author already exists'
      }, { status: 409 });
    }

    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}