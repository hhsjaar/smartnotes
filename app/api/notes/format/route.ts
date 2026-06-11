import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text, formatType } = await request.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Text tidak boleh kosong' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY tidak dikonfigurasi di server.' }, { status: 500 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    let prompt = '';

    if (formatType === 'intel') {
      // Get current local date/time in Indonesian format as context for the model
      const currentDateTimeStr = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      prompt = `Anda adalah asisten AI editor catatan profesional intelijen/keamanan. Tugas Anda adalah mengambil teks mentah hasil transkripsi suara (Voice-to-Text) di bawah ini dan merapikannya menjadi "Laporan Intel" awal (Pulbaket) dengan format yang SANGAT SPESIFIK dan kaku.

Teks Mentah Transkripsi:
"${text}"

Konteks Waktu Hari Ini (jika tidak disebutkan secara eksplisit di transkrip): ${currentDateTimeStr}

Format Output bagian 'content' harus mengikuti struktur Markdown berikut secara presisi (perhatikan spasi, baris baru, bullet point, dan daftar bernomor):

*Informasi Awal*

- Hari / Tanggal: [Hari dan Tanggal kejadian, sertakan pukul/waktu s.d selesai jika ada. Jika tidak disebutkan secara lengkap di transkrip, gunakan hari/tanggal dari ${currentDateTimeStr}], bertempat di [Lokasi/Tempat Kegiatan] telah berlangsung kegiatan [Nama Kegiatan/Diskusi] dengan tema "[Tema Kegiatan]" yang diikuti oleh [Estimasi jumlah peserta, misalnya '± 120 peserta' atau sesuai isi transkrip].

Langkah awal di lapangan : Pulbaket yang di lakukan :
1. [Langkah pertama, misalnya 'Melakukan pengamatan kegiatan untuk menghimpun informasi.' atau sesuaikan dengan tindakan intel di lapangan berdasarkan transkrip]
2. [Langkah kedua, misalnya 'Melakukan pencatatan dan dokumentasi serta berinteraksi dengan sumber atau jaringan' atau sesuaikan dengan tindakan intel di lapangan berdasarkan transkrip]
3. [Langkah ketiga, misalnya 'Melakukan pengamanan terbuka ataupun tertutup' atau sesuaikan dengan tindakan intel di lapangan berdasarkan transkrip]

Instruksi Tambahan:
- Judul bagian pertama wajib menggunakan tag bintang tunggal agar dicetak miring di markdown raw: *Informasi Awal*.
- Di bawah *Informasi Awal*, wajib menggunakan satu bullet point (- ) yang menjelaskan seluruh detail kejadian dalam satu paragraf bersambung (tidak boleh dipisah-pisah menjadi beberapa baris).
- Di bawahnya wajib menyertakan baris teks persis: "Langkah awal di lapangan : Pulbaket yang di lakukan :" (tanpa heading markdown atau bold).
- Di bawahnya tuliskan daftar langkah awal yang dilakukan secara bernomor (1., 2., 3., dst.) sesuai isi transkrip. Sesuaikan jumlah langkahnya dengan isi transkrip.
- Judul Catatan ('title') harus berformat: "Laporan Intel: [Nama Kegiatan] di [Nama Lokasi/Gedung]" (maksimal 8 kata).
- Kategori/Tags ('tags') harus menyertakan "Laporan", "Intel", serta 1-2 tag tambahan yang relevan (misalnya: "Keamanan", "Diskusi", "Pemantauan", dll).
- Ekstrak daftar tugas/tindakan konkret lanjutan ke dalam 'todo_list' jika ada. Jika tidak ada, kembalikan [].

Kembalikan hasil pemformatan HANYA dalam format JSON dengan skema berikut:
{
  "title": "Judul Catatan",
  "content": "Isi laporan intel lengkap dengan format persis seperti template di atas. Jangan berikan pengantar atau teks tambahan di luar format.",
  "tags": ["Laporan", "Intel", "TagLain"],
  "todo_list": ["Tugas 1", "Tugas 2"]
}

PENTING: Jangan menyertakan tag markdown seperti \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;
    } else if (formatType === 'laporan') {
      // Get current local date/time in Indonesian format as context for the model
      const currentDateTimeStr = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      prompt = `Anda adalah asisten AI editor catatan profesional untuk kepolisian dan satuan keamanan. Tugas Anda adalah mengambil teks mentah hasil transkripsi suara (Voice-to-Text) di bawah ini dan merapikannya menjadi "Laporan Kegiatan" resmi dengan format yang SANGAT SPESIFIK dan kaku.

Teks Mentah Transkripsi:
"${text}"

Konteks Waktu Hari Ini (jika tidak disebutkan secara eksplisit di transkrip): ${currentDateTimeStr}

Format Output bagian 'content' harus mengikuti struktur teks berikut secara presisi (tanpa header markdown ### atau ## atau # untuk judul bagian, dan tanpa bullet points/poin-poin pada bagian Informasi Kejadian):

Informasi Kejadian

Hari/Tanggal: [Hari, Tanggal kejadian. Jika tidak disebutkan di transkrip, gunakan ${currentDateTimeStr}],Lokasi TKP: [Nama lokasi/TKP] Kejadian:[Deskripsi singkat kejadian] Status Penyebab: [Penyebab kejadian, misalnya 'Belum diketahui secara pasti' atau sesuai isi transkrip]

Penanganan di Lokasi

1. *Piket Intel* [jika ada personel lain yang disebutkan, tambahkan 'bersama *<Nama Personel 1>* dan *<Nama Personel 2>*', jika tidak ada personel lain cukup tulis '*Piket Intel*'] segera mendatangi Tempat Kejadian Perkara (TKP) setelah menerima laporan.
2. Personel gabungan melakukan pengamanan area di sekitar lokasi kejadian.
3. [Kalimat yang menerangkan tindakan saat ini / tindak lanjut di lokasi kejadian sesuai isi transkrip, dengan format struktur SPOK (Subjek, Predikat, Objek, Keterangan). Contoh: "Saat ini, personel *Piket Fungsi* masih berada di lokasi untuk menangani dan mengamankan jalannya proses evakuasi serta penyelidikan awal."]

> *Catatan Penting:* [Catatan penting atau informasi krusial tambahan sesuai isi transkrip]

Instruksi Tambahan:
- Jangan gunakan penanda markdown heading (###, ##, #) atau cetak tebal (**) pada judul "Informasi Kejadian" dan "Penanganan di Lokasi". Biarkan berupa baris teks biasa.
- Jangan gunakan bullet points (-) di bawah Informasi Kejadian. Tuliskan dalam satu baris paragraf bersambung persis seperti di atas.
- Judul Catatan ('title') harus berformat: "Laporan Kegiatan: [Nama Kejadian] di [Nama Lokasi/TKP]" (maksimal 8 kata).
- Kategori/Tags ('tags') harus menyertakan "Laporan" dan "Kegiatan", serta 1-2 tag tambahan yang relevan (misalnya: "Keamanan", "Penyelidikan", dll).
- Ekstrak daftar tugas/tindakan konkret lanjutan (Action Items / TODO checklist) ke dalam 'todo_list' jika ada. Jika tidak ada, kembalikan [].

Kembalikan hasil pemformatan HANYA dalam format JSON dengan skema berikut:
{
  "title": "Judul Catatan",
  "content": "Isi laporan kegiatan lengkap dengan format teks persis seperti template di atas. Gunakan teks biasa untuk 'Informasi Kejadian' dan 'Penanganan di Lokasi' (jangan gunakan header ###, ##, #, atau bold **). Jangan gunakan bullet points (-) pada Informasi Kejadian. Jangan berikan pengantar atau teks tambahan di luar format.",
  "tags": ["Laporan", "Kegiatan", "TagLain"],
  "todo_list": ["Tugas 1", "Tugas 2"]
}

PENTING: Jangan menyertakan tag markdown seperti \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;
    } else {
      prompt = `Anda adalah asisten AI editor catatan profesional. Tugas Anda adalah mengambil teks mentah hasil transkripsi suara (Voice-to-Text) di bawah ini dan merapikannya menjadi catatan terstruktur yang sangat berkualitas dan rapi.

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
    }

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
