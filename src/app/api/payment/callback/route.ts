// src/app/api/payment/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/dbConnect';
import User from '@/models/User';
import crypto from 'crypto';

const WAYFORPAY_SECRET = process.env.WAYFORPAY_SECRET || 'flk3409refn54t54t*FNJRET';
const DEV_MODE = process.env.NODE_ENV === 'development';

export const dynamic = 'force-dynamic';

// Невеликий хелпер, щоб не дублювати розрахунок підпису в трьох місцях
function signResponse(orderReference: string, status: 'accept' | 'decline', time: number): string {
  const signString = [orderReference, status, time].join(';');
  return crypto.createHmac('md5', WAYFORPAY_SECRET).update(signString).digest('hex');
}

export async function POST(req: NextRequest) {
  // orderReference винесено сюди, щоб бути доступним і в catch, якщо req.json() вже встиг відпрацювати
  let orderReference = 'error';

  try {
    await dbConnect();

    const data = await req.json();
    orderReference = data.orderReference || 'error';

    console.log('📥 Received WayForPay callback:', data);

    // В DEV режимі пропускаємо перевірку підпису
    if (!DEV_MODE) {
      // Перевіряємо підпис WayForPay тільки в продакшені
      const signString = [
        data.merchantAccount,
        data.orderReference,
        data.amount,
        data.currency,
        data.authCode,
        data.cardPan,
        data.transactionStatus,
        data.reasonCode
      ].join(';');

      const expectedSignature = crypto
        .createHmac('md5', WAYFORPAY_SECRET)
        .update(signString)
        .digest('hex');

      if (data.merchantSignature !== expectedSignature) {
        console.error('❌ Invalid signature');

        const time = Math.floor(Date.now() / 1000);
        return NextResponse.json({
          orderReference: data.orderReference,
          status: 'decline',
          time,
          signature: signResponse(data.orderReference, 'decline', time), // 🆕
        });
      }
    } else {
      console.log('⚠️ DEV MODE: Skipping signature validation');
    }

    // Якщо платіж успішний
    if (data.transactionStatus === 'Approved') {
      const parts = data.orderReference.split('_');
      const userId = parts[1];

      const user = await User.findById(userId);

      if (!user) {
        console.error(`❌ User ${userId} not found`);
      } else if (user.lastProcessedOrderReference === data.orderReference) {
        // Цей саме orderReference вже оброблено — просто ігноруємо повтор,
        // але все одно відповідаємо коректно підписаним "accept"
        console.log(`⚠️ Order ${data.orderReference} already processed, skipping duplicate`);
      } else {
        const isPremiumYearly = parseFloat(data.amount) >= 999;
        const premiumDuration = isPremiumYearly ? 365 : 30;

        const premiumUntil = new Date();
        premiumUntil.setDate(premiumUntil.getDate() + premiumDuration);

        await User.findByIdAndUpdate(userId, {
          isPremium: true,
          premiumUntil,
          lastProcessedOrderReference: data.orderReference,
        });

        console.log(`✅ Premium activated for user ${userId} until ${premiumUntil}`);
      }
    } else {
      console.log('⚠️ Payment not approved:', data.transactionStatus);
    }

    // Відповідь із підписом
    const time = Math.floor(Date.now() / 1000);
    return NextResponse.json({
      orderReference: data.orderReference,
      status: 'accept',
      time,
      signature: signResponse(data.orderReference, 'accept', time),
    });
  } catch (err) {
    console.error('❌ Payment callback error:', err);

    // Підпис додано і в гілку помилки
    const time = Math.floor(Date.now() / 1000);
    return NextResponse.json({
      orderReference,
      status: 'decline',
      time,
      signature: signResponse(orderReference, 'decline', time),
    });
  }
}