import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Fetch all reminders
export async function GET() {
  try {
    const reminders = await prisma.reminder.findMany({
      orderBy: { dateTime: 'asc' }
    });
    return NextResponse.json(reminders);
  } catch (error: any) {
    console.error('Failed to fetch reminders:', error);
    return NextResponse.json({ error: error.message || 'Gagal memuat pengingat' }, { status: 500 });
  }
}

// Create a new reminder
export async function POST(request: Request) {
  try {
    const { title, description, dateTime, notify1Day, notify1Hour, notifyExact, whatsappNumber } = await request.json();
    if (!title || !dateTime) {
      return NextResponse.json({ error: 'Judul dan tanggal/waktu wajib diisi' }, { status: 400 });
    }

    const reminder = await prisma.reminder.create({
      data: {
        title,
        description: description || '',
        dateTime: new Date(dateTime),
        notify1Day: notify1Day !== undefined ? notify1Day : true,
        notify1Hour: notify1Hour !== undefined ? notify1Hour : true,
        notifyExact: notifyExact !== undefined ? notifyExact : true,
        sent1Day: false,
        sent1Hour: false,
        sentExact: false,
        whatsappNumber: whatsappNumber || null
      }
    });

    return NextResponse.json(reminder);
  } catch (error: any) {
    console.error('Failed to create reminder:', error);
    return NextResponse.json({ error: error.message || 'Gagal membuat pengingat' }, { status: 500 });
  }
}

// Delete a reminder
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
    }

    await prisma.reminder.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete reminder:', error);
    return NextResponse.json({ error: error.message || 'Gagal menghapus pengingat' }, { status: 500 });
  }
}
