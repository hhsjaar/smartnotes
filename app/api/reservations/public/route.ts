import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Kalender reservasi untuk publik. Hanya reservasi yang sudah dikonfirmasi admin,
// dan tanpa data pribadi (nama, nomor WA, DP, menu).
export async function GET() {
  try {
    // Awal hari ini (WIB) agar reservasi hari H tetap tampil
    const nowJkt = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const startOfTodayUtc = new Date(
      Date.UTC(nowJkt.getUTCFullYear(), nowJkt.getUTCMonth(), nowJkt.getUTCDate()) - 7 * 60 * 60 * 1000
    );

    const rows = await prisma.reservation.findMany({
      where: { status: 'confirmed', dateTime: { gte: startOfTodayUtc } },
      orderBy: { dateTime: 'asc' },
      select: { id: true, dateTime: true, partySize: true, tableInfo: true, timeNote: true },
    });
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching public reservations:', error);
    return NextResponse.json({ error: 'Gagal mengambil kalender reservasi' }, { status: 500 });
  }
}
