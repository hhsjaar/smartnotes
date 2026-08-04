const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gte = new Date(2026, 6, 1);
  const lte = new Date(2026, 7, 1);

  const totalJuly = await prisma.chatMessage.count({
    where: {
      createdAt: {
        gte,
        lt: lte
      }
    }
  });

  console.log('Total seluruh pesan di database pada bulan Juli 2026:', totalJuly);
}

main().catch(console.error).finally(() => prisma.$disconnect());
