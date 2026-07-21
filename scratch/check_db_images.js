const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const msgsWithImages = await prisma.chatMessage.findMany({
    where: {
      imageUrl: {
        not: null
      }
    },
    select: {
      id: true,
      senderName: true,
      createdAt: true,
      imageUrl: true
    }
  });

  console.log(`Found ${msgsWithImages.length} messages with imageUrl in DB.`);
  
  let totalLengthBytes = 0;
  msgsWithImages.forEach(m => {
    const len = m.imageUrl ? m.imageUrl.length : 0;
    totalLengthBytes += len;
    console.log(`Msg ID: ${m.id} | Sender: ${m.senderName} | Base64 Length: ${len} chars (~${(len/1024/1024).toFixed(2)} MB)`);
  });

  console.log(`\nTotal Base64 data stored in DB: ~${(totalLengthBytes / 1024 / 1024).toFixed(2)} MB`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
