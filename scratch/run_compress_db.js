const { PrismaClient } = require('@prisma/client');
const sharp = require('sharp');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking database messages for images to compress...');

  const messages = await prisma.chatMessage.findMany({
    where: {
      imageUrl: {
        not: null
      }
    }
  });

  console.log(`Found ${messages.length} messages with images in database.`);

  let processedCount = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;

  for (const msg of messages) {
    if (!msg.imageUrl || !msg.imageUrl.startsWith('data:image/')) {
      continue;
    }

    const originalLen = msg.imageUrl.length;
    totalBytesBefore += originalLen;

    const match = msg.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) continue;

    const base64Data = match[2];
    const inputBuffer = Buffer.from(base64Data, 'base64');

    try {
      const compressedBuffer = await sharp(inputBuffer)
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 45 })
        .toBuffer();

      const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
      const compressedLen = compressedBase64.length;

      if (compressedLen < originalLen) {
        await prisma.chatMessage.update({
          where: { id: msg.id },
          data: { imageUrl: compressedBase64 }
        });
        processedCount++;
        totalBytesAfter += compressedLen;
        console.log(`Msg ${msg.id}: Compressed ${(originalLen/1024).toFixed(1)} KB -> ${(compressedLen/1024).toFixed(1)} KB`);
      } else {
        totalBytesAfter += originalLen;
      }
    } catch (imgErr) {
      console.error(`Failed to compress image for msg ${msg.id}:`, imgErr.message);
      totalBytesAfter += originalLen;
    }
  }

  const beforeMB = (totalBytesBefore / (1024 * 1024)).toFixed(2);
  const afterMB = (totalBytesAfter / (1024 * 1024)).toFixed(2);
  const savedMB = ((totalBytesBefore - totalBytesAfter) / (1024 * 1024)).toFixed(2);

  console.log('\n=======================================');
  console.log(`Compression Summary:`);
  console.log(`Messages compressed: ${processedCount} / ${messages.length}`);
  console.log(`Original images size: ${beforeMB} MB`);
  console.log(`Compressed images size: ${afterMB} MB`);
  console.log(`Saved Database Space: ${savedMB} MB`);
  console.log('=======================================\n');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
