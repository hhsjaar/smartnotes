import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const history = await prisma.chatAttributeHistory.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 1000 // Limit safety margin
    });
    return NextResponse.json(history);
  } catch (error: any) {
    console.error('Error fetching attribute history:', error);
    return NextResponse.json({ error: 'Gagal mengambil riwayat atribut' }, { status: 500 });
  }
}
