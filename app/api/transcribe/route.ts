import { NextResponse } from 'next/server';

function getMimeType(fileName: string, fileType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'mp3' || ext === 'mpeg' || ext === 'mpg') return 'audio/mpeg';
  if (ext === 'm4a') return 'audio/m4a';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'flac') return 'audio/flac';
  if (ext === 'aac') return 'audio/aac';
  
  if (fileType && fileType.startsWith('video/')) {
    return fileType.replace('video/', 'audio/');
  }
  return fileType || 'audio/mpeg';
}

export async function POST(request: Request) {
  let uploadedFileName: string | null = null;
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File audio tidak ditemukan.' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY tidak ditemukan di environment variables.' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name, file.type);

    console.log(`Uploading audio file to Gemini Files API: ${file.name} (${file.size} bytes, MIME: ${mimeType})...`);

    // 1. Upload the file to Gemini Files API
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'X-Goog-Upload-Header-Content-Length': buffer.length.toString(),
      },
      body: buffer
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Gemini File Upload Error:', uploadRes.status, errText);
      return NextResponse.json({ error: `Gagal mengunggah file ke Gemini API: ${uploadRes.status}` }, { status: 500 });
    }

    const uploadData = await uploadRes.json();
    const fileUri = uploadData.file?.uri;
    uploadedFileName = uploadData.file?.name; // e.g. "files/abc-123"

    console.log(`Uploaded file successfully: ${uploadedFileName}, URI: ${fileUri}`);

    if (!fileUri || !uploadedFileName) {
      return NextResponse.json({ error: 'Gagal mendapatkan metadata file dari Gemini API.' }, { status: 500 });
    }

    // 2. Call generateContent with fileUri
    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            {
              fileData: {
                fileUri: fileUri,
                mimeType: mimeType
              }
            },
            {
              text: 'Tolong transkripsikan audio ini secara lengkap kata demi kata (verbatim) dalam bahasa Indonesia tanpa ada penafsiran, pemformatan tambahan, atau penambahan komentar. Tuliskan teks hasil transkripsinya saja secara utuh.'
            }
          ]
        }
      ]
    };

    console.log(`Transcribing file ${uploadedFileName} using gemini-3.5-flash...`);
    const res = await fetch(generateUrl, {
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
  } finally {
    // 3. Clean up the uploaded file asynchronously
    if (uploadedFileName && apiKey) {
      console.log(`Cleaning up file from Gemini Files storage: ${uploadedFileName}...`);
      fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadedFileName}?key=${apiKey}`, {
        method: 'DELETE'
      })
      .then(deleteRes => {
        if (deleteRes.ok) {
          console.log(`Successfully deleted file ${uploadedFileName} from Gemini storage.`);
        } else {
          console.warn(`Failed to delete file ${uploadedFileName} from Gemini storage. Status: ${deleteRes.status}`);
        }
      })
      .catch(deleteErr => {
        console.error(`Error deleting file ${uploadedFileName} from Gemini storage:`, deleteErr);
      });
    }
  }
}
