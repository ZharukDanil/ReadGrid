// src/app/api/payment/demo-activate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import { getSystemSettings } from '@/models/SystemSettings';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const settings = await getSystemSettings();
    if (!settings.paymentTestMode) {
      return NextResponse.json({ message: 'Демо-активація вимкнена адміністратором' }, { status: 403 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded: any = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 403 });
    }

    // Без цього будь-який залогінений юзер (не тільки admin/superadmin)
    // міг сам активувати собі преміум, поки тестовий режим увімкнено
    if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
      return NextResponse.json({ message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const userId = decoded.userId || decoded.id;
    const { plan } = await req.json();

    const isPremiumYearly = plan === 'yearly';
    const premiumDuration = isPremiumYearly ? 365 : 30;

    const premiumUntil = new Date();
    premiumUntil.setDate(premiumUntil.getDate() + premiumDuration);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isPremium: true, premiumUntil },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    console.log(`✅ [DEMO] Premium activated for user ${userId} until ${premiumUntil}`);

    return NextResponse.json({
      success: true,
      message: 'Premium activated successfully',
      premiumUntil,
      plan,
    });
  } catch (err) {
    console.error('Demo activation error:', err);
    return NextResponse.json({ message: 'Error activating premium' }, { status: 500 });
  }
}