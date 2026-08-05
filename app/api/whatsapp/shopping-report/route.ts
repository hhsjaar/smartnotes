import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanTargetNumber(target: string) {
  let cleaned = target.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
}

export async function sendDailyShoppingReport() {
  const token = process.env.FONNTE_API_TOKEN;
  const targetNumber = '+62 878-6333-1042';

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Find "Belanjaan All" or all attributes related to Belanja
  const allAttributes = await prisma.chatAttribute.findMany();
  
  let belanjaanAllAttr = allAttributes.find(a => a.name.toLowerCase() === 'belanjaan all' || a.name.toLowerCase() === 'belanjaan');
  let targetAttrNames: string[] = [];

  if (belanjaanAllAttr) {
    targetAttrNames.push(belanjaanAllAttr.name);
    if (belanjaanAllAttr.isGroup && Array.isArray(belanjaanAllAttr.groupAttributes)) {
      targetAttrNames.push(...(belanjaanAllAttr.groupAttributes as string[]));
    }
  }

  // Include any attribute containing 'belanja'
  allAttributes.forEach(attr => {
    if (attr.name.toLowerCase().includes('belanja') && !targetAttrNames.includes(attr.name)) {
      targetAttrNames.push(attr.name);
    }
  });

  // 2. Fetch Chat Messages from last 24 hours under those attributes
  const shoppingMessages = await prisma.chatMessage.findMany({
    where: {
      createdAt: {
        gte: twentyFourHoursAgo,
      },
      OR: [
        { attribute: { in: targetAttrNames } },
        { message: { contains: 'belanja', mode: 'insensitive' } },
        { message: { contains: 'habis', mode: 'insensitive' } },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // 3. Extract items/options from shopping attributes
  const relevantAttrs = allAttributes.filter(a => targetAttrNames.includes(a.name));
  const shoppingOptions: { attributeName: string; optionText: string; status?: string; assignedTo?: string }[] = [];

  for (const attr of relevantAttrs) {
    if (Array.isArray(attr.options)) {
      for (const opt of (attr.options as any[])) {
        const text = typeof opt === 'string' ? opt : opt.text;
        if (text) {
          shoppingOptions.push({
            attributeName: attr.name,
            optionText: text,
            status: opt.status || 'ready',
            assignedTo: opt.assignedTo || null,
          });
        }
      }
    }
  }

  // Format Date String in WIB (Asia/Jakarta)
  const dateStr = now.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  let messageText = `🛒 *LAPORAN DAFTAR BELANJAAN ALL (24 JAM TERAKHIR)* 🛒\n`;
  messageText += `📅 _${dateStr}_\n\n`;

  if (shoppingMessages.length === 0 && shoppingOptions.length === 0) {
    messageText += `Status: Tidak ada catatan atau pesan belanjaan baru yang tercatat dalam 24 jam terakhir.\n`;
  } else {
    if (shoppingMessages.length > 0) {
      messageText += `📌 *Pesan Chat Belanjaan (24 Jam Terakhir):*\n`;
      shoppingMessages.forEach((msg, idx) => {
        const timeStr = new Date(msg.createdAt).toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit'
        });
        messageText += `${idx + 1}. [${timeStr} WIB] *${msg.senderName}*: ${msg.message} _(Atribut: ${msg.attribute || 'Umum'})_\n`;
      });
      messageText += `\n`;
    }

    if (shoppingOptions.length > 0) {
      messageText += `📦 *Daftar Atribut Belanjaan Habis / Diperlukan:*\n`;
      shoppingOptions.forEach((opt, idx) => {
        const statusLabel = opt.status === 'taken' ? `(Diambil oleh: ${opt.assignedTo})` : `(Perlu dibeli)`;
        messageText += `${idx + 1}. *${opt.optionText}* _[${opt.attributeName}]_ ${statusLabel}\n`;
      });
      messageText += `\n`;
    }

    messageText += `Mohon segera diproses dan diperiksa kebutuhan belanjaannya! 💪✨`;
  }

  // Send WhatsApp if token exists
  let waSent = false;
  let waResponse: any = null;

  if (token) {
    const cleanedTarget = cleanTargetNumber(targetNumber);
    try {
      const waRes = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: cleanedTarget,
          message: messageText,
          countryCode: '62',
        }),
      });

      waResponse = await waRes.json();
      waSent = waRes.ok && waResponse.status;
    } catch (err: any) {
      console.error('Error sending WhatsApp shopping report:', err);
      waResponse = { error: err.message };
    }
  } else {
    console.warn('FONNTE_API_TOKEN is not configured for WhatsApp shopping report.');
  }

  return {
    success: waSent,
    targetNumber,
    messagesCount: shoppingMessages.length,
    optionsCount: shoppingOptions.length,
    messageText,
    waResponse
  };
}

export async function GET() {
  try {
    const result = await sendDailyShoppingReport();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing shopping report API:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengirim laporan belanjaan' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await sendDailyShoppingReport();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing shopping report API:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengirim laporan belanjaan' }, { status: 500 });
  }
}
