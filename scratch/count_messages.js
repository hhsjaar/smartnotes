const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.chatMessage.count();
  console.log('Total messages in DB:', count);
  const oldest = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
    take: 1,
  });
  if (oldest.length > 0) {
    console.log('Oldest message timestamp:', oldest[0].createdAt.toISOString());
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
