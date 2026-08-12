const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log('Now:', now.toISOString());
  console.log('24h ago:', twentyFourHoursAgo.toISOString());

  const msgs = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30
  });

  console.log(`Recent 30 messages in ChatMessage: ${msgs.length}`);
  msgs.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] sender="${m.senderName}" (${m.senderRole}), attr="${m.attribute}": "${m.message}"`);
  });

  const attrs = await prisma.chatAttribute.findMany();
  console.log('\nChat Attributes count:', attrs.length);
  attrs.forEach(a => {
    console.log(`Attr: name="${a.name}", isGroup=${a.isGroup}, options:`, a.options);
  });
}

main().finally(() => prisma.$disconnect());
