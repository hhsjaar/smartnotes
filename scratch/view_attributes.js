const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== CHAT ATTRIBUTES IN DATABASE ===');
  const attrs = await prisma.chatAttribute.findMany({
    orderBy: { name: 'asc' }
  });
  console.log(JSON.stringify(attrs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
