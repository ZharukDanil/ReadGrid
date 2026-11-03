import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const { allowed } = rateLimit(`reset:${ip}`, 10, 15 * 60_000);
    if (!allowed) {
      return NextResponse.json({ message: 'Забагато спроб. Спробуйте пізніше.' }, { status: 429 });
    }

    await dbConnect();

    const { token, password } = await req.json();

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: 'Пароль має бути мінімум 6 символів' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Атомарно: знайти за валідним токеном, змінити пароль і одразу стерти токен.
    // Завдяки цьому посилання працює лише один раз, навіть при паралельних запитах.
    const user = await User.findOneAndUpdate(
      { resetPasswordToken: tokenHash, resetPasswordExpires: { $gt: new Date() } },
      {
        $set: { password: hashedPassword },
        $unset: { resetPasswordToken: '', resetPasswordExpires: '' },
      },
      { new: true }
    );

    if (!user) {
      return NextResponse.json(
        { message: 'Посилання недійсне або термін його дії минув' },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: 'Пароль успішно змінено' }, { status: 200 });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}