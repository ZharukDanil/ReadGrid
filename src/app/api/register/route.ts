import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { username, email, password } = await req.json();

    // Валідація
    if (!username || !email || !password) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }
    if (username.length < 3) {
      return NextResponse.json({ message: 'Username must be at least 3 characters' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: 'Invalid email format' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();

    // Перевірка унікальності
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return NextResponse.json({ message: 'Email already registered' }, { status: 409 });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
    }

    // Хешування паролю
    const hashedPassword = await bcrypt.hash(password, 10);

    // Створення користувача
    const newUser = new User({
      username,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user'
    });

    await newUser.save();

    return NextResponse.json({ message: 'User registered successfully' }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
