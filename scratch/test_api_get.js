const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const chronologicalMessages = messages.reverse();
  console.log('Fetched chronological messages count:', chronologicalMessages.length);
  console.log('First message in list (oldest):', chronologicalMessages[0].createdAt.toISOString(), chronologicalMessages[0].senderName, chronologicalMessages[0].message);
  console.log('Last message in list (newest):', chronologicalMessages[chronologicalMessages.length - 1].createdAt.toISOString(), chronologicalMessages[chronologicalMessages.length - 1].senderName, chronologicalMessages[chronologicalMessages.length - 1].message);
}

main().catch(console.error).finally(() => prisma.$disconnect());
