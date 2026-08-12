const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 40
  });

  console.log('Recent 40 chat messages:');
  msgs.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] sender="${m.senderName}" (${m.senderRole}), attr="${m.attribute}": "${m.message}"`);
  });
}

main().finally(() => prisma.$disconnect());
