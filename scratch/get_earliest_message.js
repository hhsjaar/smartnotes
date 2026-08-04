const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.chatMessage.count();
  const earliest = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
    take: 5,
  });

  console.log('=== DATA BASELINE ===');
  console.log('Total seluruh pesan di database:', count);
  console.log('5 Pesan Terlama di Database:');
  earliest.forEach((m, i) => {
    console.log(`[${i + 1}] ID: ${m.id} | Waktu: ${m.createdAt.toISOString()} | Sender: ${m.senderName} (${m.senderRole}) | Atribut: ${m.attribute} | Msg: ${m.message}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
