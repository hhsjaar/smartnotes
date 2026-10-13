import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { getGlossaryPromptBlock } from '@/lib/glossary';

// POST: koreksi salah-dengar (nama, gelar, istilah) pada hasil rekam suara langsung.
// Tidak pernah memblokir alur: bila gagal/mencurigakan, kembalikan teks asli.
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Akses admin diperlukan' }, { status: 401 });
  }

  const { text } = await request.json();
  const original = String(text || '');
  if (!original.trim()) return NextResponse.json({ text: original, corrected: false });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ text: original, corrected: false });

  try {
    const glossary = await getGlossaryPromptBlock();
    const prompt = `Anda adalah editor koreksi hasil speech-to-text bahasa Indonesia.
Perbaiki HANYA kesalahan pengenalan suara: nama orang, gelar (akademik, jabatan, pangkat), nama tempat, istilah, dan ejaan yang jelas salah dengar, dengan merujuk panduan di bawah.

Aturan KETAT:
- Jangan meringkas, jangan menghapus, dan jangan menambah isi atau informasi.
- Pertahankan urutan, gaya bahasa, dan makna ucapan apa adanya.
- Ubah kata hanya bila Anda cukup yakin itu salah dengar (misalnya terdengar mirip dengan nama/gelar di panduan).
- Kembalikan HANYA teks hasil koreksi, tanpa penjelasan, tanpa tanda kutip pembuka/penutup, tanpa markdown.

${glossary}

Teks yang dikoreksi:
${original}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!res.ok) {
      console.error('Koreksi transkrip gagal:', res.status, await res.text());
      return NextResponse.json({ text: original, corrected: false });
    }
    const data = await res.json();
    const corrected = String(data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    // Pengaman: hasil koreksi tidak boleh jauh lebih pendek/panjang dari aslinya.
    // Batas atas memberi ruang tambahan karena nama + gelar lengkap dari kamus lebih panjang dari ucapan aslinya.
    const originalLength = original.trim().length;
    const ratio = corrected.length / originalLength;
    if (!corrected || ratio < 0.8 || corrected.length > originalLength * 1.25 + 300) {
      console.warn(`Hasil koreksi ditolak (rasio panjang ${ratio.toFixed(2)}), memakai teks asli.`);
      return NextResponse.json({ text: original, corrected: false });
    }
    return NextResponse.json({ text: corrected, corrected: corrected !== original.trim() });
  } catch (error) {
    console.error('Koreksi transkrip error:', error);
    return NextResponse.json({ text: original, corrected: false });
  }
}
