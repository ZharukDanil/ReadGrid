import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import { verifyToken } from '@/lib/jwt';

export async function PATCH(req: Request) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { genres } = await req.json();

    if (!Array.isArray(genres) || genres.some(g => typeof g !== 'string')) {
      return NextResponse.json({ message: 'Invalid genres payload' }, { status: 400 });
    }

    const cleanGenres = genres.slice(0, 5).map(g => g.trim()).filter(Boolean);

    const user = await User.findByIdAndUpdate(
      payload.userId,
      { $set: { preferredGenres: cleanGenres } },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ preferredGenres: user.preferredGenres }, { status: 200 });
  } catch (error: any) {
    console.error('PATCH /api/users/preferences error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(payload.userId, 'preferredGenres').lean();

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ preferredGenres: (user as any).preferredGenres || [] }, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/users/preferences error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}