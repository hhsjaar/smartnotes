import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { subscription } = await request.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Data subscription tidak valid' }, { status: 400 });
    }

    // Upsert subscription based on unique endpoint
    const saved = await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        keys: subscription.keys || {}
      },
      create: {
        endpoint: subscription.endpoint,
        keys: subscription.keys || {}
      }
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    console.error('Failed to subscribe to push notifications:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
