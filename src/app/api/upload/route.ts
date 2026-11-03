import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { verifyToken } from '@/lib/jwt';

export const runtime = 'nodejs';

const MAX_PDF_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let payload: any = null;
    try {
      payload = verifyToken(token);
    } catch {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (payload.role !== 'admin' && payload.role !== 'superadmin') {
      return NextResponse.json({ message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type');
    const access = formData.get('access') === 'premium' ? 'premium' : 'public';

    if (!file) {
      return NextResponse.json({ message: 'Файл не передано' }, { status: 400 });
    }
    if (type !== 'raw' && type !== 'image') {
      return NextResponse.json({ message: 'Невірний тип файлу' }, { status: 400 });
    }
    if (type === 'raw' && file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'Дозволені лише PDF-файли' }, { status: 400 });
    }
    if (type === 'image' && !file.type.startsWith('image/')) {
      return NextResponse.json({ message: 'Дозволені лише зображення' }, { status: 400 });
    }

    const maxSize = type === 'raw' ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: `Файл завеликий (максимум ${Math.round(maxSize / 1024 / 1024)} МБ)` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (type === 'raw' && buffer.subarray(0, 4).toString() !== '%PDF') {
      return NextResponse.json({ message: 'Файл не є коректним PDF' }, { status: 400 });
    }

    const folder = type === 'raw' ? 'readgrid/books' : 'readgrid/covers';
    
    const effectiveAccess = type === 'raw' ? access : 'public';

    const { url, publicId } = await uploadToCloudinary(buffer, folder, type, effectiveAccess);

    return NextResponse.json(
      { url: effectiveAccess === 'premium' ? null : url, publicId },
      { status: 200 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ message: 'Upload failed' }, { status: 500 });
  }
}