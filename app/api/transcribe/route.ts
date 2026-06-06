import { NextResponse } from 'next/server';

function getMimeType(fileName: string, fileType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'mp3') return 'audio/mp3';
  if (ext === 'm4a') return 'audio/m4a';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'ogg') return 'audio/ogg';
  
  if (fileType.startsWith('video/')) {
    return fileType.replace('video/', 'audio/');
  }
  return fileType || 'audio/mp3';
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File audio tidak ditemukan.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY tidak ditemukan di environment variables.' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mimeType = getMimeType(file.name, file.type);

    console.log(`Transcribing audio file: ${file.name} (${file.size} bytes, MIME: ${mimeType})...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            {
              text: 'Tolong transkripsikan audio ini secara lengkap kata demi kata (verbatim) dalam bahasa Indonesia tanpa ada penafsiran, pemformatan tambahan, atau penambahan komentar. Tuliskan teks hasil transkripsinya saja secara utuh.'
            }
          ]
        }
      ]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini Transcription Error Response:', res.status, errText);
      return NextResponse.json({ error: `Gagal mentranskripsi berkas: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const transcriptText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!transcriptText.trim()) {
      return NextResponse.json({ error: 'AI tidak mendeteksi suara atau transkrip kosong.' }, { status: 500 });
    }

    return NextResponse.json({ text: transcriptText.trim() });
  } catch (error: any) {
    console.error('Transcription Route Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan saat memproses transkripsi audio.' }, { status: 500 });
  }
}
