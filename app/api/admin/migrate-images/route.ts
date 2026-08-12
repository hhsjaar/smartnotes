import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import https from 'https';

const downloadFile = (url: string, dest: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${response.statusCode}: ${response.statusMessage}`));
      }
      const fileStream = require('fs').createWriteStream(dest);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => resolve(true));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

export async function GET() {
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadDir)) {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        imageUrl: {
          contains: 'supabase.co'
        }
      }
    });

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const msg of messages) {
      if (!msg.imageUrl) continue;
      const oldUrl = msg.imageUrl;

      try {
        const urlParts = oldUrl.split('/');
        const rawFileName = urlParts[urlParts.length - 1] || `legacy-${Date.now()}.jpg`;
        const fileName = rawFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const localFilePath = path.join(uploadDir, fileName);
        const newUrl = `/api/uploads/${fileName}`;

        await downloadFile(oldUrl, localFilePath);

        await prisma.chatMessage.update({
          where: { id: msg.id },
          data: { imageUrl: newUrl }
        });

        successCount++;
        results.push({ id: msg.id, status: 'success', oldUrl, newUrl });
      } catch (err: any) {
        failCount++;
        results.push({ id: msg.id, status: 'failed', error: err.message, oldUrl });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migrasi selesai. Berhasil: ${successCount}, Gagal: ${failCount}`,
      total: messages.length,
      successCount,
      failCount,
      results
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
