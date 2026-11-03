// src/app/api/payment/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import crypto from 'crypto';

const WAYFORPAY_MERCHANT = process.env.WAYFORPAY_MERCHANT || 'test_merch_n1';
const WAYFORPAY_SECRET = process.env.WAYFORPAY_SECRET || 'flk3409refn54t54t*FNJRET';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing token' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded: any = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 403 });
        }

        const userId = decoded.userId || decoded.id;
        const { plan } = await req.json();

        const amount = plan === 'yearly' ? 999 : 99;
        const orderReference = `premium_${userId}_${Date.now()}`;
        const orderDate = Math.floor(Date.now() / 1000);

        // Формуємо підпис для WayForPay
        const signString = [
            WAYFORPAY_MERCHANT,
            'readgrid.com',
            orderReference,
            orderDate,
            amount,
            'UAH',
            plan === 'yearly' ? 'Premium на рік' : 'Premium на місяць',
            '1',
            amount
        ].join(';');

        const merchantSignature = crypto
            .createHmac('md5', WAYFORPAY_SECRET)
            .update(signString)
            .digest('hex');

        // Отримуємо базовий URL з req.headers
        const host = req.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        console.log('🔍 Base URL:', baseUrl);

        const returnUrl = `${baseUrl}/api/payment/return`;
        const serviceUrl = `${baseUrl}/api/payment/callback`;

        const paymentData = {
            merchantAccount: WAYFORPAY_MERCHANT,
            merchantDomainName: 'readgrid.com',
            orderReference,
            orderDate,
            amount,
            currency: 'UAH',
            productName: [plan === 'yearly' ? 'Premium на рік' : 'Premium на місяць'],
            productCount: ['1'],
            productPrice: [amount],
            merchantSignature,
            returnUrl,
            serviceUrl,
            language: 'UA',
        };

        console.log('💳 Payment data:', { returnUrl, serviceUrl, orderReference });

        return NextResponse.json({
            success: true,
            paymentData,
            orderReference
        });
    } catch (err) {
        console.error('❌ Payment creation error:', err);
        return NextResponse.json({ message: 'Error creating payment' }, { status: 500 });
    }
}