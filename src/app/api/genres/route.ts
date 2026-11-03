import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import Book from '@/models/Book';

export async function GET() {
  try {
    await dbConnect();

    const books = await Book.find({}, 'genre').lean();
    const genreMap = new Map<string, string>();

    books.forEach((b: any) => {
      (b.genre || '')
        .split(/[\/,]/)
        .map((g: string) => g.trim())
        .filter(Boolean)
        .forEach((g: string) => {
          const key = g.toLowerCase();
          if (!genreMap.has(key)) genreMap.set(key, g);
        });
    });

    const genres = Array.from(genreMap.values()).sort((a, b) => a.localeCompare(b, 'uk'));

    return NextResponse.json({ genres }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}