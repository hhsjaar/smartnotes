import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      take: 200, // limit to 200 messages to prevent excessive load
    });
    return NextResponse.json(messages);
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Gagal mengambil data chat' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { senderName, senderRole, message, attribute } = await request.json();

    if (!senderName || !senderName.trim()) {
      return NextResponse.json({ error: 'Nama pengirim tidak boleh kosong' }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 });
    }

    const newMessage = await prisma.chatMessage.create({
      data: {
        senderName: senderName.trim(),
        senderRole: senderRole || 'employee',
        message: message.trim(),
        attribute: attribute || null,
      },
    });

    return NextResponse.json(newMessage);
  } catch (error: any) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ error: 'Gagal mengirim pesan' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, message, attribute, senderName, senderRole } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID pesan harus ditentukan' }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 });
    }

    const chatMsg = await prisma.chatMessage.findUnique({
      where: { id },
    });

    if (!chatMsg) {
      return NextResponse.json({ error: 'Pesan tidak ditemukan' }, { status: 404 });
    }

    // Access check: only sender or admin can edit
    if (senderRole !== 'admin' && (chatMsg.senderName !== senderName || chatMsg.senderRole !== senderRole)) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengedit pesan ini' }, { status: 403 });
    }

    const updatedMessage = await prisma.chatMessage.update({
      where: { id },
      data: {
        message: message.trim(),
        attribute: attribute || null,
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error: any) {
    console.error('Error updating chat message:', error);
    return NextResponse.json({ error: 'Gagal mengedit pesan' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const senderName = searchParams.get('senderName');
    const senderRole = searchParams.get('senderRole');

    if (!id) {
      return NextResponse.json({ error: 'ID pesan harus ditentukan' }, { status: 400 });
    }

    const chatMsg = await prisma.chatMessage.findUnique({
      where: { id },
    });

    if (!chatMsg) {
      return NextResponse.json({ error: 'Pesan tidak ditemukan' }, { status: 404 });
    }

    // Access check: only sender or admin can delete
    if (senderRole !== 'admin' && (chatMsg.senderName !== senderName || chatMsg.senderRole !== senderRole)) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk menghapus pesan ini' }, { status: 403 });
    }

    await prisma.chatMessage.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Pesan berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting chat message:', error);
    return NextResponse.json({ error: 'Gagal menghapus pesan' }, { status: 500 });
  }
}
