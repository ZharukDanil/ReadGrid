import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { sendMail } from '@/lib/mailer';

// Відповідь завжди однакова, щоб не можна було дізнатись, які email зареєстровані
const GENERIC_RESPONSE = {
  message: 'Якщо такий email зареєстровано, ми надіслали на нього лист з інструкцією.',
};

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterMs } = rateLimit(`forgot:${ip}`, 5, 15 * 60_000);
    if (!allowed) {
      return NextResponse.json(
        { message: `Забагато запитів. Спробуйте через ${Math.ceil(retryAfterMs / 60000)} хв.` },
        { status: 429 }
      );
    }

    await dbConnect();

    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (user && !user.isBlocked) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // updateOne замість save(), щоб не проганяти повну валідацію документа
      await User.updateOne(
        { _id: user._id },
        { $set: { resetPasswordToken: tokenHash, resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000) } }
      );

      // Базовий URL береться з env, а не із заголовків запиту (захист від підміни Host)
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      // Без await, щоб час відповіді не залежав від того, чи існує email
      sendMail({
        to: user.email,
        subject: 'Відновлення пароля ReadGrid',
        text: `Щоб задати новий пароль, перейдіть за посиланням (дійсне 1 годину):\n${resetUrl}\n\nЯкщо ви не робили цей запит, просто проігноруйте лист.`,
        html: `<p>Щоб задати новий пароль, натисніть кнопку (посилання дійсне 1 годину):</p>
               <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#705444;color:#f8d9a6;border-radius:8px;text-decoration:none;">Змінити пароль</a></p>
               <p style="color:#888;">Якщо ви не робили цей запит, просто проігноруйте лист.</p>`,
      }).catch((err) => console.error('Mail send error:', err));
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}