import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import { verifyToken } from '@/lib/jwt';
import Book from '@/models/Book';
import User from '@/models/User';
import { dbConnect } from '@/lib/dbConnect';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let payload: any = null;
    try {
      payload = verifyToken(token);
    } catch {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const book = await Book.findById(id);
    if (!book) return NextResponse.json({ message: 'Книгу не знайдено' }, { status: 404 });

    if (book.isPremium) {
      const user: any = await User.findById(payload.id ?? payload.userId ?? payload._id).lean();
      const isAdmin = payload.role === 'admin' || payload.role === 'superadmin';
      const hasPremium = user?.isPremium === true;

      if (!isAdmin && !hasPremium) {
        return NextResponse.json({ message: 'Потрібен преміум-доступ' }, { status: 403 });
      }
    }

    if (!book.filePublicId) {
      
      return NextResponse.json({ url: book.fileUrl });
    }

    const url = cloudinary.utils.private_download_url(book.filePublicId, '', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 600,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Book file error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}