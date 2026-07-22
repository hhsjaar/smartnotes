import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '150', 10);
    const before = searchParams.get('before');

    // Fetch most recent messages (descending) and reverse for chronological display
    const messages = await prisma.chatMessage.findMany({
      where: before ? {
        createdAt: {
          lt: new Date(before),
        },
      } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
    const chronologicalMessages = messages.reverse();
    return NextResponse.json(chronologicalMessages, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Gagal mengambil data chat' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { senderName, senderRole, message, attribute, imageUrl } = await request.json();

    if (!senderName || !senderName.trim()) {
      return NextResponse.json({ error: 'Nama pengirim tidak boleh kosong' }, { status: 400 });
    }
    if ((!message || !message.trim()) && !imageUrl) {
      return NextResponse.json({ error: 'Pesan atau gambar tidak boleh kosong' }, { status: 400 });
    }

    const newMessage = await prisma.chatMessage.create({
      data: {
        senderName: senderName.trim(),
        senderRole: senderRole || 'employee',
        message: message ? message.trim() : '',
        imageUrl: imageUrl || null,
        attribute: attribute || null,
      },
    });

    // Fire-and-forget Chatbot execution in background without blocking response
    if (senderRole !== 'admin' && attribute) {
      runAIChatbotAsync(senderName, senderRole, message, attribute).catch(botErr => {
        console.error('Error running background AI Chatbot:', botErr);
      });
    }

    return NextResponse.json(newMessage);
  } catch (error: any) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ error: 'Gagal mengirim pesan' }, { status: 500 });
  }
}

async function runAIChatbotAsync(senderName: string, senderRole: string, message: string, attribute: string) {
  try {
    const chatAttr = await prisma.chatAttribute.findFirst({
      where: {
        name: {
          equals: attribute,
          mode: 'insensitive'
        }
      }
    });

    if (chatAttr && chatAttr.chatbotEnabled) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        // Fetch list of ready options under this attribute
        const readyTasksList: string[] = [];
        const opts = Array.isArray(chatAttr.options) ? (chatAttr.options as any[]) : [];
        opts.forEach(opt => {
          if (opt.hasTimeframe && opt.status === 'ready') {
            readyTasksList.push(`- ${opt.text} (Jangka waktu: ${opt.duration || '1 hari'})`);
          }
        });
        const readyTasksListStr = readyTasksList.join('\n') || 'Tidak ada tugas/jobdesk yang tersedia saat ini.';

        // Fetch recent 10 messages for context
        const recentMsgs = await prisma.chatMessage.findMany({
          where: { attribute },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
        const conversationHistoryStr = [...recentMsgs].reverse().map(m => `${m.senderName} (${m.senderRole}): ${m.message}`).join('\n');

        const promptText = `
Anda adalah AI Chatbot Asisten untuk grup chat koordinasi karyawan Burjolevelup.
Karyawan bernama "${senderName}" baru saja mengirim pesan di kategori/atribut "${attribute}".

Daftar Jobdesk / Tugas Progres yang SIAP dikerjakan (Ready):
${readyTasksListStr}

Histori obrolan terakhir di kategori "${attribute}":
${conversationHistoryStr}

Pesan terbaru karyawan: "${message}"

TUGAS ANDA:
1. Analisis apakah pesan terbaru karyawan merupakan pertanyaan yang ditujukan ke admin/sistem/bot terkait tugas, jobdesk yang ready, koordinasi, atau bantuan.
2. Jika merupakan pertanyaan atau membutuhkan jawaban, berikan balasan yang singkat (maksimal 2-3 kalimat), ramah, dan bermanfaat dalam Bahasa Indonesia. Jika ditanya tentang jobdesk/progress yang ready, sebutkan pilihan yang ada di atas.
3. Jika pesan tersebut HANYA berupa laporan selesai (misal: "laporan sales aman", "progres selesai"), sapaan saja ("p", "pagi", "halo"), atau informasi sepihak yang tidak memerlukan jawaban, Anda WAJIB menjawab hanya dengan satu kata: "NO_RESPONSE". Jangan menjawab apa-apa lagi jika tidak perlu direspon.
`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.2 }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          const botReply = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (botReply && botReply.toUpperCase() !== 'NO_RESPONSE' && botReply !== 'NO_RESPONSE.') {
            await prisma.chatMessage.create({
              data: {
                senderName: 'AI Chatbot',
                senderRole: 'admin',
                message: botReply,
                attribute: attribute,
              }
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed in runAIChatbotAsync:', err);
  }
}

export async function PUT(request: Request) {
  try {
    const { id, message, attribute, senderName, senderRole, imageUrl } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID pesan harus ditentukan' }, { status: 400 });
    }
    if ((!message || !message.trim()) && !imageUrl) {
      return NextResponse.json({ error: 'Pesan atau gambar tidak boleh kosong' }, { status: 400 });
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
        message: message ? message.trim() : '',
        imageUrl: imageUrl || null,
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
