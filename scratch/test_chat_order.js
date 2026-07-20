const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.chatMessage.count();
  console.log('Total count of chat messages in DB:', total);

  const oldWay = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  console.log('Old way (asc take 200) returned count:', oldWay.length);
  if (oldWay.length > 0) {
    console.log('Old way latest message date:', oldWay[oldWay.length - 1].createdAt.toISOString());
  }

  const newWay = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const chronological = newWay.reverse();
  console.log('New way (desc take 200 reversed) returned count:', chronological.length);
  if (chronological.length > 0) {
    console.log('New way latest message date:', chronological[chronological.length - 1].createdAt.toISOString());
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
