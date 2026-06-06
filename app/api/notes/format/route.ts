import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Text tidak boleh kosong' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY tidak dikonfigurasi di server.' }, { status: 500 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Anda adalah asisten AI editor catatan profesional. Tugas Anda adalah mengambil teks mentah hasil transkripsi suara (Voice-to-Text) di bawah ini dan merapikannya menjadi catatan terstruktur yang sangat berkualitas dan rapi.

Teks Mentah Transkripsi:
"${text}"

Instruksi Pemformatan:
1. Perbaiki kesalahan ejaan, tanda baca, huruf kapital, dan tata bahasa (terutama dalam bahasa Indonesia atau Inggris, sesuaikan dengan bahasa yang diucapkan).
2. Buat judul yang sangat relevan dan menarik untuk catatan ini (maksimal 6 kata).
3. Formatlah isi catatan ('content') secara sangat rapi, berstruktur, dan nyaman dibaca menggunakan Markdown. Jangan hanya membuat paragraf panjang yang padat. Gunakan kombinasi:
   - Poin-poin / daftar bullet (-) untuk detail/informasi penting
   - Daftar berurutan / angka (1., 2., 3.) untuk proses langkah demi langkah atau kronologi
   - Sub-header (## atau ###) untuk memisahkan topik/bagian pembicaraan
   - Kutipan (>) untuk pernyataan penting atau kutipan langsung
   - Cetak tebal (bold) pada konsep/istilah kunci untuk meningkatkan visual hierarki
4. Ekstrak daftar tugas/tindakan konkret (Action Items / TODO checklist) yang harus dilakukan berdasarkan pembicaraan. Jika tidak ada tindakan nyata, buat daftar kosong [].
5. Rekomendasikan 2-4 tag/kategori yang relevan untuk catatan ini (misalnya: Rapat, Ide, Tugas, Keuangan, Pribadi, dll).

Kembalikan hasil pemformatan HANYA dalam format JSON dengan skema berikut:
{
  "title": "Judul Catatan",
  "content": "Isi catatan yang diformat sangat rapi dengan sub-header, daftar poin/bullet points, daftar bernomor, tebal, dll. agar nyaman dibaca. Jangan sertakan todo list di dalam 'content' ini.",
  "tags": ["Tag1", "Tag2"],
  "todo_list": ["Tugas 1", "Tugas 2"]
}

PENTING: Jangan menyertakan tag markdown seperti \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
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
      console.error('Gemini Format Error:', res.status, errText);
      return NextResponse.json({ error: `Gagal memformat catatan melalui Gemini: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return NextResponse.json({ error: 'Tidak ada respons dari model AI.' }, { status: 500 });
    }

    const formattedNote = JSON.parse(resultText.trim());
    formattedNote.summary = text; // Override summary with original raw speech transcript
    return NextResponse.json(formattedNote);
  } catch (error: any) {
    console.error('API Format Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
