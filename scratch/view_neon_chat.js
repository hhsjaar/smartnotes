require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  console.log('Total messages in Neon:', msgs.length);
  msgs.forEach((m, i) => {
    console.log(`[${i + 1}] ID: ${m.id} | Waktu: ${m.createdAt.toISOString()} | Sender: ${m.senderName} (${m.senderRole}) | Atribut: ${m.attribute || 'null'} | Msg: ${m.message}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
