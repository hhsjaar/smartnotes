import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const { name, dateTime, tableInfo, partySize, dpAmount, menuList } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama reservasi tidak boleh kosong' }, { status: 400 });
    }
    if (!dateTime) {
      return NextResponse.json({ error: 'Tanggal boking tidak boleh kosong' }, { status: 400 });
    }
    if (!tableInfo || !tableInfo.trim()) {
      return NextResponse.json({ error: 'Tempat / Meja harus diisi' }, { status: 400 });
    }
    const size = parseInt(partySize);
    if (isNaN(size) || size <= 0) {
      return NextResponse.json({ error: 'Jumlah orang harus lebih besar dari 0' }, { status: 400 });
    }
    if (!menuList || !menuList.trim()) {
      return NextResponse.json({ error: 'Menu / List makanan harus diisi' }, { status: 400 });
    }

    // Validasi tanggal tidak di masa lalu (mendukung hari H)
    const bookingDate = new Date(dateTime);
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

    const newReservation = await prisma.reservation.create({
      data: {
        name: name.trim(),
        dateTime: new Date(dateTime),
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
    const { id, status, dpAmount, name, dateTime, tableInfo, partySize, menuList } = await request.json();

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
    if (dateTime) updateData.dateTime = new Date(dateTime);
    if (tableInfo) updateData.tableInfo = tableInfo.trim();
    if (partySize !== undefined) updateData.partySize = parseInt(partySize) || reservation.partySize;
    if (menuList) updateData.menuList = menuList.trim();

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
