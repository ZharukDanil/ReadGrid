import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import { getSystemSettings } from '@/models/SystemSettings';
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

    const settings = await getSystemSettings();

    return NextResponse.json({
      paymentTestMode: settings.paymentTestMode,
      updatedAt: settings.updatedAt,
    }, { status: 200 });
  } catch (error: any) {
    console.error('GET /api/admin/settings error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await dbConnect();

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payload: any = verifyToken(token);

    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ message: 'Access denied. Admin only.' }, { status: 403 });
    }

    const { paymentTestMode } = await req.json();
    if (typeof paymentTestMode !== 'boolean') {
      return NextResponse.json({ message: 'Invalid value' }, { status: 400 });
    }

    const settings = await getSystemSettings();
    settings.paymentTestMode = paymentTestMode;
    settings.updatedBy = payload.userId;
    await settings.save();

    console.log(`⚙️ Payment test mode ${paymentTestMode ? 'УВІМКНЕНО' : 'ВИМКНЕНО'} адміном ${payload.username}`);

    return NextResponse.json({ paymentTestMode: settings.paymentTestMode }, { status: 200 });
  } catch (error: any) {
    console.error('PATCH /api/admin/settings error:', error);
    return NextResponse.json({ message: 'Server error', error: error.message }, { status: 500 });
  }
}