import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import { signToken } from '@/lib/jwt';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// Заглушка, щоб час відповіді не видавав, чи існує такий email
const DUMMY_HASH = bcrypt.hashSync('readgrid-dummy-password', 10);

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterMs } = rateLimit(`login:${ip}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { message: `Забагато спроб входу. Спробуйте через ${Math.ceil(retryAfterMs / 1000)} сек.` },
        { status: 429 }
      );
    }

    await dbConnect();

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    const isMatch = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !isMatch) {
      return NextResponse.json({ message: 'Authorization failed' }, { status: 401 });
    }

    // Блокування перевіряємо лише після правильного пароля
    if (user.isBlocked) {
      return NextResponse.json({ message: 'Ваш обліковий запис заблоковано' }, { status: 403 });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signToken({
      userId: String(user._id),
      username: user.username,
      role: user.role,
      email: user.email,
    });

    return NextResponse.json({ token }, { status: 200 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Authorization failed' }, { status: 500 });
  }
}