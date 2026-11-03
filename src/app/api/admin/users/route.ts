import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import { verifyToken } from '@/lib/jwt';

export async function GET(req: Request) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim();

    const query: any = {};
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ username: searchRegex }, { email: searchRegex }];
    }

    const users = await User.find(query, '-password')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ users }, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}