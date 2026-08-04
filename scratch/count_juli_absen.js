const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gte = new Date(2026, 6, 1);
  const lte = new Date(2026, 7, 1);

  const msgCount = await prisma.chatMessage.count({
    where: {
      senderName: {
        contains: 'ragil',
        mode: 'insensitive'
      },
      createdAt: {
        gte,
        lt: lte
      }
    }
  });

  const allMsgs = await prisma.chatMessage.findMany({
    where: {
      senderName: {
        contains: 'ragil',
        mode: 'insensitive'
      },
      createdAt: {
        gte,
        lt: lte
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const historyCount = await prisma.chatAttributeHistory.count({
    where: {
      assignedTo: {
        contains: 'ragil',
        mode: 'insensitive'
      },
      recordedAt: {
        gte,
        lt: lte
      }
    }
  });

  console.log('=== DATA GROUND TRUTH BULAN JULI ===');
  console.log('Jumlah pesan chat Ragil di Juli:', msgCount);
  console.log('Jumlah riwayat absensi (check-in/out) Ragil di Juli:', historyCount);
  console.log('\nRincian pesan chat Ragil di Juli:');
  allMsgs.forEach((m, idx) => {
    console.log(`[${idx + 1}] Waktu: ${m.createdAt.toISOString()} | Atribut: ${m.attribute} | Msg: ${m.message}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
