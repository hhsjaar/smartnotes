const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function formatWibTime(date) {
  const timeStr = date.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return timeStr.replace(':', '.');
}

function normalizeAttributeName(attrName) {
  if (!attrName) return 'Belanja Lain-lain';
  let cleaned = attrName.replace(/["']/g, '').trim();
  const lower = cleaned.toLowerCase();
  if (lower.includes('lain')) return 'Belanja Lain-lain';
  if (lower.includes('sembako')) return 'Belanja Sembako';
  if (lower.includes('pasar')) return 'Belanja Pasar';
  if (lower.includes('superindo')) return 'Belanja Superindo';
  if (lower.includes('online')) return 'Belanja Online';
  
  // Capitalize each word
  return cleaned.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function getCategoryIcon(attrName) {
  const lower = (attrName || '').toLowerCase();
  if (lower.includes('superindo') || lower.includes('lain')) return '🛍️';
  if (lower.includes('online')) return '📦';
  return '🛒';
}

function formatItemText(text) {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip leading bullet symbols like -, *, •, 1., etc.
  cleaned = cleaned.replace(/^[\-*\u2022\d+\.\s]+/, '').trim();
  if (!cleaned) return '';

  // Clean common abbreviations / typos
  cleaned = cleaned.replace(/\b5\s*rbu\b/gi, '5 ribu');
  cleaned = cleaned.replace(/\b10\s*rbu\b/gi, '10 ribu');
  cleaned = cleaned.replace(/\brbu\b/gi, 'ribu');
  cleaned = cleaned.replace(/\bbumbu\s+fren\s+fres\b/gi, 'Bumbu French Fries');
  cleaned = cleaned.replace(/\bfren\s+fres\b/gi, 'French Fries');
  cleaned = cleaned.replace(/\bskm\b/gi, 'SKM');
  cleaned = cleaned.replace(/\bsledri\b/gi, 'Seledri');
  cleaned = cleaned.replace(/\bsauce\b/gi, 'Saus');

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

async function testReportFormatting() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Find all ChatAttributes
  const allAttributes = await prisma.chatAttribute.findMany();
  let targetAttrNames = [];

  allAttributes.forEach(attr => {
    if (attr.name.toLowerCase().includes('belanja') && !targetAttrNames.includes(attr.name)) {
      targetAttrNames.push(attr.name);
    }
  });

  // 2. Fetch ChatMessages from last 24 hours under shopping attributes
  const shoppingMessages = await prisma.chatMessage.findMany({
    where: {
      createdAt: {
        gte: twentyFourHoursAgo,
      },
      OR: [
        { attribute: { in: targetAttrNames } },
        { attribute: { contains: 'belanja', mode: 'insensitive' } },
        { message: { contains: 'belanja', mode: 'insensitive' } },
        { message: { contains: 'habis', mode: 'insensitive' } },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  let messageText = `*📋 REKAP BELANJA HARI INI*\n\n`;

  if (shoppingMessages.length === 0) {
    messageText += `Belum ada daftar belanjaan yang dicatat dalam 24 jam terakhir.\n`;
  } else {
    // Group messages by senderName
    const senderGroups = new Map();

    shoppingMessages.forEach(msg => {
      const senderKey = (msg.senderName || 'Karyawan').trim();
      if (!senderGroups.has(senderKey)) {
        senderGroups.set(senderKey, {
          senderName: senderKey,
          senderRole: msg.senderRole || 'employee',
          messages: []
        });
      }
      senderGroups.get(senderKey).messages.push(msg);
    });

    const senderBlocks = [];

    for (const [senderName, group] of senderGroups.entries()) {
      const senderNameUpper = senderName.toUpperCase();
      const roleLabel = group.senderRole === 'admin' ? 'Admin' : 'Karyawan';
      
      let senderBlock = `👤 *${senderNameUpper} - ${roleLabel}*\n\n`;

      const msgBlocks = [];
      group.messages.forEach(msg => {
        const normAttr = normalizeAttributeName(msg.attribute);
        const icon = getCategoryIcon(normAttr);
        const timeStr = formatWibTime(new Date(msg.createdAt));

        const rawLines = (msg.message || '').split(/\r?\n/);
        const itemLines = [];
        rawLines.forEach(line => {
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

      senderBlock += msgBlocks.join('\n\n');
      senderBlocks.push(senderBlock);
    }

    messageText += senderBlocks.join('\n\n');
  }

  console.log('=== GENERATED WHATSAPP MESSAGE ===\n');
  console.log(messageText);
  console.log('\n==================================');
}

testReportFormatting().finally(() => prisma.$disconnect());
