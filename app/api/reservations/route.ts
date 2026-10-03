import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper function to parse dateTime string as WIB (UTC+7) if no timezone offset is present
function parseDateTimeAsWIB(dateTimeStr: string): Date {
  if (!dateTimeStr) return new Date();
  if (dateTimeStr.includes('Z') || /[+-]\d{2}:\d{2}$/.test(dateTimeStr)) {
    return new Date(dateTimeStr);
  }
  return new Date(`${dateTimeStr}+07:00`);
}

// Normalisasi nomor WA ke format internasional tanpa '+' (cth: 08581234 -> 628581234)
function normalizePhone(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

// Kode booking pendek untuk mencocokkan chat WhatsApp dengan data reservasi
async function generateBookingCode(): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa karakter mirip (0/O, 1/I)
  for (let attempt = 0; attempt < 5; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const code = `BRJ-${suffix}`;
    const exists = await prisma.reservation.findUnique({ where: { code } });
    if (!exists) return code;
  }
  return `BRJ-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

// GET: Ambil semua data reservasi untuk admin
export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
      orderBy: {
        dateTime: 'asc',
      },
    });
    return NextResponse.json(reservations);
  } catch (error: any) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json({ error: 'Gagal mengambil data reservasi' }, { status: 500 });
  }
}

// POST: Membuat reservasi baru oleh customer
export async function POST(request: Request) {
  try {
    const { name, dateTime, tableInfo, partySize, dpAmount, menuList, phone } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama reservasi tidak boleh kosong' }, { status: 400 });
    }
    if (!dateTime) {
      return NextResponse.json({ error: 'Tanggal boking tidak boleh kosong' }, { status: 400 });
    }
    if (!tableInfo || !tableInfo.trim()) {
      return NextResponse.json({ error: 'Tempat / Meja harus diisi' }, { status: 400 });
    }
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return NextResponse.json({ error: 'Nomor WhatsApp tidak valid' }, { status: 400 });
    }
    const size = parseInt(partySize);
    if (isNaN(size) || size <= 0) {
      return NextResponse.json({ error: 'Jumlah orang harus lebih besar dari 0' }, { status: 400 });
    }
    if (!menuList || !menuList.trim()) {
      return NextResponse.json({ error: 'Menu / List makanan harus diisi' }, { status: 400 });
    }

    // Validasi tanggal tidak di masa lalu (mendukung hari H)
    const bookingDate = parseDateTimeAsWIB(dateTime);
    const now = new Date();
    if (bookingDate.getTime() < now.getTime() - 5 * 60 * 1000) { // toleransi 5 menit
      return NextResponse.json({ 
        error: 'Tanggal booking tidak boleh di masa lalu.' 
      }, { status: 400 });
    }

    // Validasi reservasi minimal 4 orang
    if (size < 4) {
      return NextResponse.json({ 
        error: 'Syarat Ketentuan: Reservasi minimal untuk 4 orang.' 
      }, { status: 400 });
    }

    const code = await generateBookingCode();
    const newReservation = await prisma.reservation.create({
      data: {
        phone: normalizedPhone,
        code,
        name: name.trim(),
        dateTime: bookingDate,
        tableInfo: tableInfo.trim(),
        partySize: size,
        dpAmount: parseFloat(dpAmount) || 0,
        menuList: menuList.trim(),
        status: 'pending',
      },
    });

    return NextResponse.json(newReservation);
  } catch (error: any) {
    console.error('Error creating reservation:', error);
    return NextResponse.json({ error: 'Gagal membuat reservasi' }, { status: 500 });
  }
}

// PUT: Memperbarui status / detail reservasi oleh admin
export async function PUT(request: Request) {
  try {
    const { id, status, dpAmount, name, dateTime, tableInfo, partySize, menuList, phone, dpPaid, timeNote } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID reservasi harus ditentukan' }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservasi tidak ditemukan' }, { status: 404 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (dpAmount !== undefined) updateData.dpAmount = parseFloat(dpAmount) || 0;
    if (name) updateData.name = name.trim();
    if (dateTime) updateData.dateTime = parseDateTimeAsWIB(dateTime);
    if (tableInfo) updateData.tableInfo = tableInfo.trim();
    if (partySize !== undefined) updateData.partySize = parseInt(partySize) || reservation.partySize;
    if (menuList) updateData.menuList = menuList.trim();
    if (phone) updateData.phone = normalizePhone(phone);
    if (typeof dpPaid === 'boolean') updateData.dpPaid = dpPaid;
    if (timeNote !== undefined) updateData.timeNote = (timeNote || '').trim() || null;

    const updated = await prisma.reservation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating reservation:', error);
    return NextResponse.json({ error: 'Gagal memperbarui reservasi' }, { status: 500 });
  }
}

// DELETE: Menghapus data reservasi oleh admin
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID reservasi harus ditentukan' }, { status: 400 });
    }

    await prisma.reservation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Reservasi berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json({ error: 'Gagal menghapus data reservasi' }, { status: 500 });
  }
}
