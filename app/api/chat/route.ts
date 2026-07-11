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
