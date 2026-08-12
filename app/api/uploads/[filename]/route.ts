import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Prevent path traversal attacks
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'public', 'uploads', sanitizedFilename);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);

    // Determine basic content type
    let contentType = 'image/jpeg';
    if (sanitizedFilename.endsWith('.png')) contentType = 'image/png';
    else if (sanitizedFilename.endsWith('.webp')) contentType = 'image/webp';
    else if (sanitizedFilename.endsWith('.gif')) contentType = 'image/gif';
    else if (sanitizedFilename.endsWith('.svg')) contentType = 'image/svg+xml';

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Error reading upload file:', error);
    return NextResponse.json({ error: 'Gagal mengambil file' }, { status: 500 });
  }
}
