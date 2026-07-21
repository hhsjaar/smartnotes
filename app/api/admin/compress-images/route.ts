import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        imageUrl: {
          not: null
        }
      }
    });

    let processedCount = 0;
    let totalBytesBefore = 0;
    let totalBytesAfter = 0;

    for (const msg of messages) {
      if (!msg.imageUrl || !msg.imageUrl.startsWith('data:image/')) {
        continue;
      }

      const originalLen = msg.imageUrl.length;
      totalBytesBefore += originalLen;

      // Extract format and base64 string
      const match = msg.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) continue;

      const base64Data = match[2];
      const inputBuffer = Buffer.from(base64Data, 'base64');

      try {
        // Compress image using sharp to max 600px width/height and quality 45 JPEG
        const compressedBuffer = await sharp(inputBuffer)
          .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 45 })
          .toBuffer();

        const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
        const compressedLen = compressedBase64.length;
        totalBytesAfter += compressedLen;

        // Only update if the compressed version is smaller
        if (compressedLen < originalLen) {
          await prisma.chatMessage.update({
            where: { id: msg.id },
            data: { imageUrl: compressedBase64 }
          });
          processedCount++;
        } else {
          totalBytesAfter = totalBytesAfter - compressedLen + originalLen;
        }
      } catch (imgErr) {
        console.error(`Failed to compress image for message ID ${msg.id}:`, imgErr);
      }
    }

    const savedMB = ((totalBytesBefore - totalBytesAfter) / (1024 * 1024)).toFixed(2);
    const beforeMB = (totalBytesBefore / (1024 * 1024)).toFixed(2);
    const afterMB = (totalBytesAfter / (1024 * 1024)).toFixed(2);

    return NextResponse.json({
      success: true,
      processedCount,
      totalMessagesChecked: messages.length,
      beforeMB: `${beforeMB} MB`,
      afterMB: `${afterMB} MB`,
      savedMB: `${savedMB} MB`
    });
  } catch (error: any) {
    console.error('Error running DB image compression:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengompresi gambar database' }, { status: 500 });
  }
}
