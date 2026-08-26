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

function formatWibTime(date: Date): string {
  const timeStr = date.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return timeStr.replace(':', '.');
}

function normalizeAttributeName(attrName?: string | null): string {
  if (!attrName) return 'Progres Harian';
  let cleaned = attrName.replace(/["']/g, '').trim();
  const lower = cleaned.toLowerCase();
  if (lower.includes('progres') || lower.includes('progress')) return 'Progres Harian';
  
  return cleaned.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function getCategoryIcon(attrName?: string | null): string {
  const lower = (attrName || '').toLowerCase();
  if (lower.includes('progres') || lower.includes('progress')) return '📈';
  return '📊';
}

function formatItemText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip leading bullet symbols like -, *, •, 1., etc.
  cleaned = cleaned.replace(/^[\-*\u2022\d+\.\s]+/, '').trim();
  if (!cleaned) return '';

  // Clean common abbreviations / typos if any
  cleaned = cleaned.replace(/\b5\s*rbu\b/gi, '5 ribu');
  cleaned = cleaned.replace(/\b10\s*rbu\b/gi, '10 ribu');

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export async function sendDailyProgressReport() {
  const token = process.env.FONNTE_API_TOKEN;
  const targetNumber = '+62 878-6333-1042';

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Find all attributes related to Progres
  const allAttributes = await prisma.chatAttribute.findMany();
  let targetAttrNames: string[] = [];

  let progresAttr = allAttributes.find(a => 
    a.name.toLowerCase() === 'progres' || 
    a.name.toLowerCase() === 'progress' ||
    a.name.toLowerCase() === 'progres harian'
  );

  if (progresAttr) {
    targetAttrNames.push(progresAttr.name);
    if (progresAttr.isGroup && Array.isArray(progresAttr.groupAttributes)) {
      targetAttrNames.push(...(progresAttr.groupAttributes as string[]));
    }
  }

  allAttributes.forEach(attr => {
    if ((attr.name.toLowerCase().includes('progres') || attr.name.toLowerCase().includes('progress')) && !targetAttrNames.includes(attr.name)) {
      targetAttrNames.push(attr.name);
    }
  });

  // Default fallback if no specific attribute exists in DB yet
  if (targetAttrNames.length === 0) {
    targetAttrNames = ['Progres', 'Progress', 'Progres Harian'];
  }

  // 2. Fetch Chat Messages strictly from last 24 hours
  const progressMessages = await prisma.chatMessage.findMany({
    where: {
      createdAt: {
        gte: twentyFourHoursAgo,
      },
      OR: [
        { attribute: { in: targetAttrNames } },
        { attribute: { contains: 'progres', mode: 'insensitive' } },
        { attribute: { contains: 'progress', mode: 'insensitive' } },
        { message: { contains: 'progres', mode: 'insensitive' } },
        { message: { contains: 'progress', mode: 'insensitive' } },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  let messageText = `*📊 REKAP PROGRES HARI INI*\n\n`;

  if (progressMessages.length === 0) {
    messageText += `Belum ada laporan progres yang dicatat dalam 24 jam terakhir.\n`;
  } else {
    // Group messages by senderName
    const senderGroups = new Map<string, { senderName: string; senderRole: string; messages: any[] }>();

    progressMessages.forEach((msg: any) => {
      const senderKey = (msg.senderName || 'Karyawan').trim();
      if (!senderGroups.has(senderKey)) {
        senderGroups.set(senderKey, {
          senderName: senderKey,
          senderRole: msg.senderRole || 'employee',
          messages: []
        });
      }
      senderGroups.get(senderKey)!.messages.push(msg);
    });

    const senderBlocks: string[] = [];

    for (const [senderName, group] of senderGroups.entries()) {
      const senderNameUpper = senderName.toUpperCase();
      const roleLabel = group.senderRole === 'admin' ? 'Admin' : 'Karyawan';

      let senderBlock = `👤 *${senderNameUpper} - ${roleLabel}*\n\n`;

      const msgBlocks: string[] = [];
      group.messages.forEach((msg: any) => {
        const normAttr = normalizeAttributeName(msg.attribute);
        const icon = getCategoryIcon(normAttr);
        const timeStr = formatWibTime(new Date(msg.createdAt));

        const rawLines = (msg.message || '').split(/\r?\n/);
        const itemLines: string[] = [];
        rawLines.forEach((line: string) => {
          const formatted = formatItemText(line);
          if (formatted) {
            itemLines.push(`- ${formatted}`);
          }
        });

        if (itemLines.length > 0) {
          let block = `${icon} *${normAttr}*\n`;
          block += itemLines.join('\n') + `\n`;
          block += `🕐 ${timeStr}`;
          msgBlocks.push(block);
        }
      });

      if (msgBlocks.length > 0) {
        senderBlock += msgBlocks.join('\n\n');
        senderBlocks.push(senderBlock);
      }
    }

    if (senderBlocks.length > 0) {
      messageText += senderBlocks.join('\n\n');
    } else {
      messageText += `Belum ada laporan progres yang dicatat dalam 24 jam terakhir.\n`;
    }
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
      console.error('Error sending WhatsApp progress report:', err);
      waResponse = { error: err.message };
    }
  } else {
    console.warn('FONNTE_API_TOKEN is not configured for WhatsApp progress report.');
  }

  return {
    success: waSent,
    targetNumber,
    messagesCount: progressMessages.length,
    messageText,
    waResponse
  };
}

export async function GET() {
  try {
    const result = await sendDailyProgressReport();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing progress report API:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengirim laporan progres' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await sendDailyProgressReport();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing progress report API:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengirim laporan progres' }, { status: 500 });
  }
}
