import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { text, formatType, selectedFolderIds, singleNote } = await request.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Text tidak boleh kosong' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY tidak dikonfigurasi di server.' }, { status: 500 });
    }

    // Load existing folders along with their hierarchy and latest notes
    const allFolders = await prisma.folder.findMany({
      include: {
        notes: {
          select: {
            title: true,
            summary: true,
            tags: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 3,
        }
      }
    });

    const rootFolders = allFolders.filter(f => !f.parentId);
    const foldersContext = rootFolders.map(parent => {
      const subfolders = allFolders.filter(f => f.parentId === parent.id);
      return {
        id: parent.id,
        name: parent.name,
        existing_notes_context: parent.notes
          .map((n) => `- Judul: "${n.title}", Ringkasan: "${n.summary}", Tags: [${n.tags.join(', ')}]`)
          .join('\n') || '(Belum ada catatan di folder ini)',
        subfolders: subfolders.map(child => ({
          id: child.id,
          name: child.name,
          existing_notes_context: child.notes
            .map((n) => `- Judul: "${n.title}", Ringkasan: "${n.summary}", Tags: [${n.tags.join(', ')}]`)
            .join('\n') || '(Belum ada catatan di subfolder ini)'
        }))
      };
    });

    let folderConstraintPrompt = '';
    if (selectedFolderIds && Array.isArray(selectedFolderIds) && selectedFolderIds.length > 0) {
      const selectedParents = allFolders.filter(f => !f.parentId && selectedFolderIds.includes(f.id));
      if (selectedParents.length > 0) {
        const listStr = selectedParents.map(f => `- Folder Utama: "${f.name}" (ID: "${f.id}")`).join('\n');
        
        folderConstraintPrompt = `
PENTING - BATASAN TARGET PENYIMPANAN:
Pengguna telah membatasi folder penyimpanan hanya pada folder utama berikut:
${listStr}

Anda WAJIB mengklasifikasikan catatan baru ini ke dalam salah satu dari folder utama yang dipilih tersebut, ATAU ke dalam salah satu dari subfolder-nya yang sesuai di bawah folder utama tersebut (berdasarkan daftar subfolder di atas).
- Jika catatan cocok dengan salah satu subfolder dari folder utama pilihan, isi 'folderId' dengan ID subfolder tersebut, 'folderName' dengan nama subfolder tersebut, dan 'parentFolderName' dengan nama folder utamanya.
- Jika tidak ada subfolder yang cocok secara spesifik, isi 'folderId' dengan ID folder utama tersebut dan 'folderName' dengan nama folder utama tersebut.
- Jangan mengklasifikasikannya ke folder utama lain atau subfolder di luar folder utama pilihan pengguna.
`;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    let prompt = '';
    const currentDateTimeStr = new Date().toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const singleNoteConstraint = singleNote ? `
PENTING - MODE CATATAN TUNGGAL (SINGLE NOTE MODE):
Anda DILARANG KERAS memecah transkripsi ini menjadi beberapa catatan pecahan. Anda juga DILARANG membuat 'Catatan Master' di folder 'Utuh' atau menambahkan bagian 'Rincian Topik per Folder'. Cukup buat tepat 1 catatan tunggal yang memformat seluruh transkripsi tersebut menjadi format yang diminta, lalu kembalikan dalam array 'notes' berisi tepat 1 objek saja.
` : '';

    if (formatType === 'intel') {
      prompt = `Anda adalah asisten AI editor catatan profesional intelijen/keamanan. Tugas Anda adalah mengambil teks mentah hasil transkripsi suara (Voice-to-Text) di bawah ini, menganalisis kontennya, dan merapikannya menjadi "Laporan Intel" awal (Pulbaket) dengan format yang SANGAT SPESIFIK dan kaku.
PENTING: Buatlah semua ringkasan dan catatan Anda (baik catatan pecahan maupun Catatan Master) secara sangat detail, komprehensif, mendalam, dan sangat jelas. Jangan menyederhanakan, merangkum terlalu pendek, atau menghilangkan detail spesifik seperti nama orang, nama tempat/lokasi, waktu/jam, angka-angka penting, kutipan ucapan, atau konteks pembicaraan.
Selain catatan pecahan tersebut, Anda wajib membuat satu catatan tambahan sebagai 'Catatan Master' (versi utuh) yang menggabungkan seluruh kejadian/topik tersebut menjadi 1 catatan terstruktur (bukan diringkas dalam format baru yang menghilangkan detail, melainkan digabungkan dan diparafrase secara rapi dengan mengelompokkannya per topik). Format konten ('content') Catatan Master ini harus mencantumkan Hari/Tanggal transkrip, diikuti dengan rincian detail masing-masing topik (Judul Topik & Isi Catatan Laporan Intel lengkapnya per topik secara berurutan). 
Di bagian paling bawah konten ('content') Catatan Master, setelah laporan gabungan detail yang komprehensif, Anda wajib menambahkan pemisah horizontal (---) dan bagian khusus berjudul '### Rincian Topik per Folder'. Bagian ini berisi daftar ringkasan/catatan AI dari masing-masing topik pecahan yang telah dikelompokkan ke dalam foldernya masing-masing dengan format yang jelas, seperti berikut:
---
### Rincian Topik per Folder

**Folder: [Nama Folder]**
- Judul Catatan: [Judul Catatan Pecahan]
- Isi Catatan: [Isi Lengkap Catatan Pecahan]

Catatan Master ini secara khusus dimasukkan ke folder "Utuh" (isi 'folderName' dengan "Utuh" dan 'folderId' dengan null). Namun jika hanya ada satu topik intelijen, cukup buat 1 catatan saja (tidak perlu membuat Catatan Master di folder "Utuh" dan tidak perlu menambahkan bagian 'Rincian Topik per Folder').
${singleNoteConstraint}

Teks Mentah Transkripsi:
"${text}"

Konteks Waktu Hari Ini (jika tidak disebutkan secara eksplisit di transkrip): ${currentDateTimeStr}

Daftar Folder saat ini di database beserta rangkuman isi catatan di dalamnya: ${JSON.stringify(foldersContext)}

Format Output bagian 'content' untuk setiap catatan harus mengikuti struktur Markdown berikut secara presisi:

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
- Di bawahnya tuliskan daftar langkah awal yang dilakukan secara bernomor (1., 2., 3., dst.) sesuai isi transkrip.
- Judul Catatan ('title') harus berformat: "Laporan Intel: [Nama Kegiatan] di [Nama Lokasi/Gedung]" (maksimal 8 kata). Untuk Catatan Master di folder "Utuh", berikan judul seperti "Laporan Intel Utuh: [Ringkasan Topik-Topik]".
- Kategori/Tags ('tags') harus menyertakan "Laporan", "Intel", serta 1-2 tag tambahan yang relevan.
- Ekstrak daftar tugas/tindakan konkret lanjutan ke dalam 'todo_list' jika ada. Jika tidak ada, kembalikan [].
- Nilai dari 'summary' harus berupa teks transkripsi asli (mentah/verbatim) yang diambil langsung dari "Teks Mentah Transkripsi" yang berhubungan dengan catatan/laporan ini, tanpa parafrase, perubahan kata, atau ringkasan dari AI. Jika catatan ini adalah Catatan Master atau jika hanya ada satu catatan, isi 'summary' dengan seluruh isi teks transkripsi asli secara utuh.

Aturan Klasifikasi Folder & Subfolder (Berdasarkan Konteks Isi Catatan):
Anda WAJIB menaruh catatan baru ke dalam folder/subfolder yang paling relevan berdasarkan acuan utama di bawah ini:
1. Acuan Awal Klasifikasi adalah menentukan Folder Induk (Parent Folder) terlebih dahulu:
   - **Perusahaan**: Masukkan ke folder ini jika catatan membahas tentang warung, burjolevelup, cafe, restoran, bisnis kuliner, operasional warung, belanjaan/pembelian bahan makanan, briefing operasional, SOP, laporan kantor, dsb. Setelah menentukan folder "Perusahaan", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Belanjaan', 'Briefing Operasional', 'Laporan Kantor', 'Pengembangan Produk', 'SOP', 'Temuan Harian', 'Progres Harian').
   - **Polsek**: Masukkan ke folder ini jika catatan membahas tentang masyarakat, laporan keamanan, ketertiban umum, kepolisian, tugas intel, pengumpulan informasi intelijen, data teks sambutan tokoh masyarakat, pemberdayaan masyarakat, dsb. Setelah menentukan folder "Polsek", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Temuan Harian', 'Progres Harian', 'Laporan Keamanan', 'Pemberdayaan Masyarakat').
   - **Pribadi**: Masukkan ke folder ini jika catatan membahas tentang wawasan, pengetahuan, pengembangan diri (self-development), catatan pribadi (self-notes), edukasi, keuangan pribadi/personal, diskusi ilmiah/edukatif, dsb. Setelah menentukan folder "Pribadi", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Keuangan', 'Diskusi & Edukasi').
   - **Utuh**: Khusus untuk 'Catatan Master' (Catatan Utuh yang menggabungkan beberapa topik pecahan), wajib dimasukkan ke folder "Utuh" (folderName: "Utuh", folderId: null).
2. Cara menentukan 'folderId', 'folderName', dan 'parentFolderName' dalam output JSON:
   - Jika catatan cocok dengan suatu subfolder (misalnya subfolder 'Belanjaan' di bawah parent 'Perusahaan'), isi 'folderId' dengan ID subfolder tersebut dari Daftar Folder, 'folderName' dengan nama subfolder tersebut, dan 'parentFolderName' dengan nama parent foldernya ("Perusahaan").
   - Jika catatan cocok dengan folder induk namun tidak ada subfolder yang spesifik, isi 'folderId' dengan ID folder induk tersebut, 'folderName' dengan nama folder induk tersebut, dan 'parentFolderName' dengan null.
   - Jika tidak ada folder/subfolder yang cocok sama sekali di database namun diperlukan kategori baru, buat subfolder/folder baru dengan mengisi 'folderName' sesuai nama kategori baru tersebut, isi 'folderId' dengan null, and 'parentFolderName' dengan nama folder induknya (misalnya "Perusahaan", "Polsek", atau "Pribadi") jika kategori baru itu merupakan subkategori.
   - Jika merupakan catatan umum yang tidak memerlukan folder khusus, isi 'folderId': null, 'folderName': null, dan 'parentFolderName': null.
${folderConstraintPrompt}

Kembalikan hasil pemformatan HANYA dalam format JSON dengan skema array berikut:
{
  "notes": [
    {
      "title": "Judul Catatan",
      "content": "Isi laporan intel lengkap dengan format persis seperti template di atas. Jangan berikan pengantar atau teks tambahan di luar format.",
      "summary": "Teks transkripsi asli (mentah/verbatim) dari hasil rekaman suara yang bersangkutan dengan bagian laporan intel ini, tanpa parafrase, pemformatan, atau ringkasan AI.",
      "tags": ["Laporan", "Intel", "TagLain"],
      "todo_list": ["Tugas 1", "Tugas 2"],
      "folderId": "id-folder-yang-cocok-atau-null",
      "folderName": "NamaFolderBaruAtauNull",
      "parentFolderName": "NamaFolderIndukJikaSubfolderAtauNull"
    }
  ]
}

PENTING: Jangan menyertakan tag markdown seperti \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;    } else if (formatType === 'laporan') {
      prompt = `Anda adalah asisten AI editor catatan profesional untuk kepolisian dan satuan keamanan. Tugas Anda adalah mengambil teks mentah hasil transkripsi suara (Voice-to-Text) di bawah ini, menganalisis kontennya, dan merapikannya menjadi "Laporan Kegiatan" resmi dengan format yang SANGAT SPESIFIK dan kaku.
PENTING: Buatlah semua ringkasan dan catatan Anda (baik catatan pecahan maupun Catatan Master) secara sangat detail, komprehensif, mendalam, dan sangat jelas. Jangan menyederhanakan, merangkum terlalu pendek, atau menghilangkan detail spesifik seperti nama orang, nama tempat/lokasi, waktu/jam, angka-angka penting, penyebab kejadian, atau tindakan yang diambil.
Jika teks mengandung lebih dari satu topik kejadian/kegiatan keamanan yang berbeda, maka PECAHLAH isi rekaman tersebut menjadi beberapa catatan laporan kegiatan yang berbeda secara logis.
Selain itu, jika teks dipecah menjadi beberapa catatan berbeda karena memiliki beberapa topik pembicaraan/bahasan/kejadian, Anda WAJIB membuat satu catatan tambahan sebagai 'Catatan Master' (versi utuh) yang menggabungkan seluruh kejadian/kegiatan tersebut menjadi 1 catatan terstruktur (bukan diringkas dalam format baru yang menghilangkan detail, melainkan digabungkan dan diparafrase secara rapi dengan mengelompokkannya per topik). Format konten ('content') Catatan Master ini harus mencantumkan Hari/Tanggal transkrip, diikuti dengan rincian detail masing-masing topik (Judul Topik & Isi Catatan Laporan Kegiatan lengkapnya per topik secara berurutan). 
Di bagian paling bawah konten ('content') Catatan Master, setelah laporan gabungan detail yang komprehensif, Anda wajib menambahkan pemisah horizontal (---) dan bagian khusus berjudul '### Rincian Topik per Folder'. Bagian ini berisi daftar ringkasan/catatan AI dari masing-masing topik pecahan yang telah dikelompokkan ke dalam foldernya masing-masing dengan format yang jelas, seperti berikut:
---
### Rincian Topik per Folder

**Folder: [Nama Folder]**
- Judul Catatan: [Judul Catatan Pecahan]
- Isi Catatan: [Isi Lengkap Catatan Pecahan]

Catatan Master ini secara khusus dimasukkan ke folder "Utuh" (isi 'folderName' dengan "Utuh" dan 'folderId' dengan null). Namun jika hanya ada satu topik kejadian/kegiatan, cukup buat 1 catatan saja (tidak perlu membuat Catatan Master di folder "Utuh" dan tidak perlu menambahkan bagian 'Rincian Topik per Folder').
${singleNoteConstraint}

Teks Mentah Transkripsi:
"${text}"

Konteks Waktu Hari Ini (jika tidak disebutkan secara eksplisit di transkrip): ${currentDateTimeStr}

Daftar Folder saat ini di database beserta rangkuman isi catatan di dalamnya: ${JSON.stringify(foldersContext)}

Format Output bagian 'content' untuk setiap catatan harus mengikuti struktur teks berikut secara presisi (tanpa header markdown ### atau ## atau # untuk judul bagian, dan tanpa bullet points/poin-poin pada bagian Informasi Kejadian):

Informasi Kejadian

Hari/Tanggal: [Hari, Tanggal kejadian. Jika tidak disebutkan di transkrip, gunakan ${currentDateTimeStr}],Lokasi TKP: [Nama lokasi/TKP] Kejadian:[Deskripsi singkat kejadian] Status Penyebab: [Penyebab kejadian, misalnya 'Belum diketahui secara pasti' atau sesuai isi transkrip]

Penanganan di Lokasi

1. *Piket Intel* [jika ada personel lain yang disebutkan, tambahkan 'bersama *<Nama Personel 1>* dan *<Nama Personel 2>*', jika tidak ada personel lain cukup tulis '*Piket Intel*'] segera mendatangi Tempat Kejadian Perkara (TKP) setelah menerima laporan.
2. Personel gabungan melakukan pengamanan area di sekitar lokasi kejadian.
3. [Kalimat yang menerangkan tindakan saat ini / tindak lanjut di lokasi kejadian sesuai isi transkrip, dengan format struktur SPOK (Subjek, Predikat, Objek, Keterangan).]

> *Catatan Penting:* [Catatan penting atau informasi krusial tambahan sesuai isi transkrip]

Instruksi Tambahan:
- Jangan gunakan penanda markdown heading (###, ##, #) or cetak tebal (**) pada judul "Informasi Kejadian" dan "Penanganan di Lokasi". Biarkan berupa baris teks biasa.
- Jangan gunakan bullet points (-) di bawah Informasi Kejadian. Tuliskan dalam satu baris paragraf bersambung persis seperti di atas.
- Judul Catatan ('title') harus berformat: "Laporan Kegiatan: [Nama Kejadian] di [Nama Lokasi/TKP]" (maksimal 8 kata). Untuk Catatan Master di folder "Utuh", berikan judul seperti "Laporan Kegiatan Utuh: [Ringkasan Topik-Topik]".
- Kategori/Tags ('tags') harus menyertakan "Laporan" dan "Kegiatan", serta 1-2 tag tambahan yang relevan.
- Ekstrak daftar tugas/tindakan konkret lanjutan ke dalam 'todo_list' jika ada. Jika tidak ada, kembalikan [].
- Nilai dari 'summary' harus berupa teks transkripsi asli (mentah/verbatim) yang diambil langsung dari "Teks Mentah Transkripsi" yang berhubungan dengan catatan/laporan ini, tanpa parafrase, perubahan kata, atau ringkasan dari AI. Jika catatan ini adalah Catatan Master atau jika hanya ada satu catatan, isi 'summary' dengan seluruh isi teks transkripsi asli secara utuh.

Aturan Klasifikasi Folder & Subfolder (Berdasarkan Konteks Isi Catatan):
Anda WAJIB menaruh catatan baru ke dalam folder/subfolder yang paling relevan berdasarkan acuan utama di bawah ini:
1. Acuan Awal Klasifikasi adalah menentukan Folder Induk (Parent Folder) terlebih dahulu:
   - **Perusahaan**: Masukkan ke folder ini jika catatan membahas tentang warung, burjolevelup, cafe, restoran, bisnis kuliner, operasional warung, belanjaan/pembelian bahan makanan, briefing operasional, SOP, laporan kantor, dsb. Setelah menentukan folder "Perusahaan", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Belanjaan', 'Briefing Operasional', 'Laporan Kantor', 'Pengembangan Produk', 'SOP', 'Temuan Harian', 'Progres Harian').
   - **Polsek**: Masukkan ke folder ini jika catatan membahas tentang masyarakat, laporan keamanan, ketertiban umum, kepolisian, tugas intel, pengumpulan informasi intelijen, data teks sambutan tokoh masyarakat, pemberdayaan masyarakat, dsb. Setelah menentukan folder "Polsek", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Temuan Harian', 'Progres Harian', 'Laporan Keamanan', 'Pemberdayaan Masyarakat').
   - **Pribadi**: Masukkan ke folder ini jika catatan membahas tentang wawasan, pengetahuan, pengembangan diri (self-development), catatan pribadi (self-notes), edukasi, keuangan pribadi/personal, diskusi ilmiah/edukatif, dsb. Setelah menentukan folder "Pribadi", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Keuangan', 'Diskusi & Edukasi').
   - **Utuh**: Khusus untuk 'Catatan Master' (Catatan Utuh yang menggabungkan beberapa topik pecahan), wajib dimasukkan ke folder "Utuh" (folderName: "Utuh", folderId: null).
2. Cara menentukan 'folderId', 'folderName', dan 'parentFolderName' dalam output JSON:
   - Jika catatan cocok dengan suatu subfolder (misalnya subfolder 'Belanjaan' di bawah parent 'Perusahaan'), isi 'folderId' dengan ID subfolder tersebut dari Daftar Folder, 'folderName' dengan nama subfolder tersebut, dan 'parentFolderName' dengan nama parent foldernya ("Perusahaan").
   - Jika catatan cocok dengan folder induk namun tidak ada subfolder yang spesifik, isi 'folderId' dengan ID folder induk tersebut, 'folderName' dengan nama folder induk tersebut, dan 'parentFolderName' dengan null.
   - Jika tidak ada folder/subfolder yang cocok sama sekali di database namun diperlukan kategori baru, buat subfolder/folder baru dengan mengisi 'folderName' sesuai nama kategori baru tersebut, isi 'folderId' dengan null, dan 'parentFolderName' dengan nama folder induknya (misalnya "Perusahaan", "Polsek", atau "Pribadi") jika kategori baru itu merupakan subkategori.
   - Jika merupakan catatan umum yang tidak memerlukan folder khusus, isi 'folderId': null, 'folderName': null, dan 'parentFolderName': null.
${folderConstraintPrompt}

Kembalikan hasil pemformatan HANYA dalam format JSON dengan skema array berikut:
{
  "notes": [
    {
      "title": "Judul Catatan",
      "content": "Isi laporan kegiatan lengkap dengan format teks persis seperti template di atas. Gunakan teks biasa untuk 'Informasi Kejadian' dan 'Penanganan di Lokasi'. Jangan gunakan bullet points (-) pada Informasi Kejadian. Jangan berikan pengantar atau teks tambahan di luar format.",
      "summary": "Teks transkripsi asli (mentah/verbatim) dari hasil rekaman suara yang bersangkutan dengan bagian laporan kegiatan ini, tanpa parafrase, pemformatan, atau ringkasan AI.",
      "tags": ["Laporan", "Kegiatan", "TagLain"],
      "todo_list": ["Tugas 1", "Tugas 2"],
      "folderId": "id-folder-yang-cocok-atau-null",
      "folderName": "NamaFolderBaruAtauNull",
      "parentFolderName": "NamaFolderIndukJikaSubfolderAtauNull"
    }
  ]
}

PENTING: Jangan menyertakan tag markdown seperti \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;    } else if (formatType === 'poin' || formatType === 'point') {
      prompt = `Anda adalah asisten AI editor catatan profesional. Tugas Anda adalah mengambil teks mentah hasil transkripsi suara (Voice-to-Text) di bawah ini, menganalisis kontennya, dan memparafrase catatan tersebut menjadi format ringkasan poin-poin penting yang SANGAT SINGKAT, PADAT, JELAS, dan langsung ke inti permasalahan (to the point) tanpa basa-basi atau bertele-tele.
PENTING:
- Hindari kalimat pembuka, pengantar, kesimpulan normatif, atau teks dekoratif.
- Tuliskan informasi penting dalam bentuk poin-poin (bullet points).
- Setiap poin harus singkat, padat, dan memuat informasi konkret (seperti angka, waktu, nama orang/tempat, atau tindakan spesifik jika ada).
- Hapus semua repetisi atau bagian pembicaraan yang bertele-tele dari transkrip mentah.

Jika tidak menggunakan mode catatan tunggal dan teks mengandung lebih dari satu topik pembicaraan/bahasan/ide yang berbeda secara signifikan, maka Anda diperbolehkan memecah isi rekaman tersebut menjadi beberapa catatan terpisah secara logis sesuai masing-masing topik. Selain itu, buatlah satu catatan tambahan sebagai 'Catatan Master' (versi utuh) yang menggabungkan seluruh topik tersebut. Catatan Master ini secara khusus dimasukkan ke folder "Utuh" (folderName: "Utuh", folderId: null). Namun jika hanya ada satu topik, cukup buat 1 catatan saja (tidak perlu membuat Catatan Master di folder "Utuh" dan tidak perlu menambahkan bagian 'Rincian Topik per Folder').
${singleNoteConstraint}

Teks Mentah Transkripsi:
"${text}"

Konteks Waktu Hari Ini (jika tidak disebutkan secara eksplisit di transkrip): ${currentDateTimeStr}

Daftar Folder saat ini di database beserta rangkuman isi catatan di dalamnya: ${JSON.stringify(foldersContext)}

Format Output bagian 'content' untuk setiap catatan harus mengikuti struktur Markdown berikut secara presisi:

### Poin-Poin Penting Catatan:
- [Poin pertama yang singkat, padat, jelas]
- [Poin kedua yang singkat, padat, jelas]
... (dst.)

Instruksi Tambahan:
- Judul Catatan ('title') harus berformat: "Poin Penting: [Topik Utama]" (maksimal 6 kata). Untuk Catatan Master di folder "Utuh", berikan judul seperti "Poin Penting Utuh: [Ringkasan Topik-Topik]".
- Kategori/Tags ('tags') harus menyertakan "Poin", "Ringkasan", serta 1-2 tag tambahan yang relevan.
- Ekstrak daftar tugas/tindakan konkret lanjutan ke dalam 'todo_list' jika ada. Jika tidak ada, kembalikan [].
- Nilai dari 'summary' harus berupa teks transkripsi asli (mentah/verbatim) yang diambil langsung dari "Teks Mentah Transkripsi" yang berhubungan dengan catatan ini, tanpa parafrase, perubahan kata, atau ringkasan dari AI. Jika catatan ini adalah Catatan Master atau jika hanya ada satu catatan, isi 'summary' dengan seluruh isi teks transkripsi asli secara utuh.

Aturan Klasifikasi Folder & Subfolder (Berdasarkan Konteks Isi Catatan):
Anda WAJIB menaruh catatan baru ke dalam folder/subfolder yang paling relevan berdasarkan acuan utama di bawah ini:
1. Acuan Awal Klasifikasi adalah menentukan Folder Induk (Parent Folder) terlebih dahulu:
   - **Perusahaan**: Masukkan ke folder ini jika catatan membahas tentang warung, burjolevelup, cafe, restoran, bisnis kuliner, operasional warung, belanjaan/pembelian bahan makanan, briefing operasional, SOP, laporan kantor, dsb. Setelah menentukan folder "Perusahaan", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Belanjaan', 'Briefing Operasional', 'Laporan Kantor', 'Pengembangan Produk', 'SOP', 'Temuan Harian', 'Progres Harian').
   - **Polsek**: Masukkan ke folder ini jika catatan membahas tentang masyarakat, laporan keamanan, ketertiban umum, kepolisian, tugas intel, pengumpulan informasi intelijen, data teks sambutan tokoh masyarakat, pemberdayaan masyarakat, dsb. Setelah menentukan folder "Polsek", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Temuan Harian', 'Progres Harian', 'Laporan Keamanan', 'Pemberdayaan Masyarakat').
   - **Pribadi**: Masukkan ke folder ini jika catatan membahas tentang wawasan, pengetahuan, pengembangan diri (self-development), catatan pribadi (self-notes), edukasi, keuangan pribadi/personal, diskusi ilmiah/edukatif, dsb. Setelah menentukan folder "Pribadi", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Keuangan', 'Diskusi & Edukasi').
   - **Utuh**: Khusus untuk 'Catatan Master' (Catatan Utuh yang menggabungkan beberapa topik pecahan), wajib dimasukkan ke folder "Utuh" (folderName: "Utuh", folderId: null).
2. Cara menentukan 'folderId', 'folderName', dan 'parentFolderName' dalam output JSON:
   - Jika catatan cocok dengan suatu subfolder (misalnya subfolder 'Belanjaan' di bawah parent 'Perusahaan'), isi 'folderId' dengan ID subfolder tersebut dari Daftar Folder, 'folderName' dengan nama subfolder tersebut, dan 'parentFolderName' dengan nama parent foldernya ("Perusahaan").
   - Jika catatan cocok dengan folder induk namun tidak ada subfolder yang spesifik, isi 'folderId' dengan ID folder induk tersebut, 'folderName' dengan nama folder induk tersebut, dan 'parentFolderName' dengan null.
   - Jika tidak ada folder/subfolder yang cocok sama sekali di database namun diperlukan kategori baru, buat subfolder/folder baru dengan mengisi 'folderName' sesuai nama kategori baru tersebut, isi 'folderId' dengan null, dan 'parentFolderName' dengan nama folder induknya (misalnya "Perusahaan", "Polsek", atau "Pribadi") jika kategori baru itu merupakan subkategori.
   - Jika merupakan catatan umum yang tidak memerlukan folder khusus, isi 'folderId': null, 'folderName': null, dan 'parentFolderName': null.
${folderConstraintPrompt}

Kembalikan hasil pemformatan HANYA dalam format JSON dengan skema array berikut:
{
  "notes": [
    {
      "title": "Judul Catatan",
      "content": "Isi catatan yang diformat dengan poin-poin penting secara singkat, padat, dan jelas. Jangan sertakan pengantar, kesimpulan, atau todo list di dalam 'content' ini.",
      "summary": "Teks transkripsi asli (mentah/verbatim) dari hasil rekaman suara yang bersangkutan dengan catatan ini, tanpa parafrase, pemformatan, atau ringkasan AI.",
      "tags": ["Poin", "Ringkasan", "TagLain"],
      "todo_list": ["Tugas 1", "Tugas 2"],
      "folderId": "id-folder-yang-cocok-atau-null",
      "folderName": "NamaFolderBaruAtauNull",
      "parentFolderName": "NamaFolderIndukJikaSubfolderAtauNull"
    }
  ]
}

PENTING: Jangan menyertakan tag markdown seperti \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;    } else {
      prompt = `Anda adalah asisten AI editor catatan profesional. Tugas Anda adalah mengambil teks mentah hasil transkripsi suara (Voice-to-Text) di bawah ini, menganalisis kontennya, dan merapikannya menjadi catatan terstruktur yang sangat berkualitas dan rapi.
PENTING: Buatlah semua ringkasan dan catatan Anda (baik catatan pecahan maupun Catatan Master) secara sangat detail, komprehensif, mendalam, dan sangat jelas. Jangan menyederhanakan, merangkum terlalu pendek, atau menghilangkan detail spesifik seperti nama, tanggal/hari, waktu/jam, angka-angka penting, detail pembahasan, ide-ide kunci, atau penjelasan detail lainnya.
Jika teks mengandung lebih dari satu topik pembicaraan/bahasan/ide yang berbeda, maka PECAHLAH isi rekaman tersebut menjadi beberapa catatan terpisah secara logis sesuai dengan masing-masing topik.
Selain itu, jika teks dipecah menjadi beberapa catatan berbeda karena memiliki beberapa topik pembicaraan/bahasan/ide, Anda WAJIB membuat satu catatan tambahan sebagai 'Catatan Master' (versi utuh) yang menggabungkan seluruh topik/bahasan tersebut menjadi 1 catatan terstruktur (bukan diringkas dalam format baru yang menghilangkan detail, melainkan digabungkan dan diparafrase secara rapi dengan mengelompokkannya per topik). Format konten ('content') Catatan Master ini harus mencantumkan Hari/Tanggal transkrip, diikuti dengan rincian detail masing-masing topik (Judul Topik & Isi Catatan lengkapnya per topik secara berurutan). 
Di bagian paling bawah konten ('content') Catatan Master, setelah ringkasan gabungan detail yang komprehensif, Anda wajib menambahkan pemisah horizontal (---) dan bagian khusus berjudul '### Rincian Topik per Folder'. Bagian ini berisi daftar ringkasan/catatan AI dari masing-masing topik pecahan yang telah dikelompokkan ke dalam foldernya masing-masing dengan format yang jelas, seperti berikut:
---
### Rincian Topik per Folder

**Folder: [Nama Folder]**
- Judul Catatan: [Judul Catatan Pecahan]
- Isi Catatan: [Isi Lengkap Catatan Pecahan]

Catatan Master ini secara khusus dimasukkan ke folder "Utuh" (isi 'folderName' dengan "Utuh" dan 'folderId' dengan null). Namun jika hanya ada satu topik, cukup buat 1 catatan saja (tidak perlu membuat Catatan Master di folder "Utuh" dan tidak perlu menambahkan bagian 'Rincian Topik per Folder').
${singleNoteConstraint}

Teks Mentah Transkripsi:
"${text}"

Daftar Folder saat ini di database beserta rangkuman isi catatan di dalamnya: ${JSON.stringify(foldersContext)}

Instruksi Pemformatan Setiap Catatan:
1. Perbaiki kesalahan ejaan, tanda baca, huruf kapital, dan tata bahasa (terutama dalam bahasa Indonesia atau Inggris, sesuaikan dengan bahasa yang diucapkan).
2. Buat judul yang sangat relevan dan menarik untuk catatan ini (maksimal 6 kata). Untuk Catatan Master di folder "Utuh", berikan judul seperti "Catatan Utuh: [Ringkasan Topik-Topik]".
3. Formatlah isi catatan ('content') secara sangat rapi, berstruktur, dan nyaman dibaca menggunakan Markdown. Jangan hanya membuat paragraf panjang yang padat. Gunakan kombinasi:
   - Poin-poin / daftar bullet (-) untuk detail/informasi penting
   - Daftar berurutan / angka (1., 2., 3.) untuk proses langkah demi langkah atau kronologi
   - Sub-header (## atau ###) untuk memisahkan topik/bagian pembicaraan
   - Kutipan (>) untuk pernyataan penting atau kutipan langsung
   - Cetak tebal (bold) pada konsep/istilah kunci untuk meningkatkan visual hierarki
4. Ekstrak daftar tugas/tindakan konkret (Action Items / TODO checklist) yang harus dilakukan berdasarkan pembicaraan. Jika tidak ada tindakan nyata, buat daftar kosong [].
5. Rekomendasikan 2-4 tag/kategori yang relevan untuk catatan ini (misalnya: Rapat, Ide, Tugas, Keuangan, Pribadi, dll).
6. Nilai dari 'summary' harus berupa teks transkripsi asli (mentah/verbatim) yang diambil langsung dari "Teks Mentah Transkripsi" yang berhubungan dengan catatan ini, tanpa parafrase, perubahan kata, atau ringkasan dari AI. Jika catatan ini adalah Catatan Master atau jika hanya ada satu catatan, isi 'summary' dengan seluruh isi teks transkripsi asli secara utuh.

Aturan Klasifikasi Folder & Subfolder (Berdasarkan Konteks Isi Catatan):
Anda WAJIB menaruh catatan baru ke dalam folder/subfolder yang paling relevan berdasarkan acuan utama di bawah ini:
1. Acuan Awal Klasifikasi adalah menentukan Folder Induk (Parent Folder) terlebih dahulu:
   - **Perusahaan**: Masukkan ke folder ini jika catatan membahas tentang warung, burjolevelup, cafe, restoran, bisnis kuliner, operasional warung, belanjaan/pembelian bahan makanan, briefing operasional, SOP, laporan kantor, dsb. Setelah menentukan folder "Perusahaan", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Belanjaan', 'Briefing Operasional', 'Laporan Kantor', 'Pengembangan Produk', 'SOP', 'Temuan Harian', 'Progres Harian').
   - **Polsek**: Masukkan ke folder ini jika catatan membahas tentang masyarakat, laporan keamanan, ketertiban umum, kepolisian, tugas intel, pengumpulan informasi intelijen, data teks sambutan tokoh masyarakat, pemberdayaan masyarakat, dsb. Setelah menentukan folder "Polsek", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Temuan Harian', 'Progres Harian', 'Laporan Keamanan', 'Pemberdayaan Masyarakat').
   - **Pribadi**: Masukkan ke folder ini jika catatan membahas tentang wawasan, pengetahuan, pengembangan diri (self-development), catatan pribadi (self-notes), edukasi, keuangan pribadi/personal, diskusi ilmiah/edukatif, dsb. Setelah menentukan folder "Pribadi", cocokkan dan pilih subfolder yang paling sesuai di bawahnya (misalnya: 'Keuangan', 'Diskusi & Edukasi').
   - **Utuh**: Khusus untuk 'Catatan Master' (Catatan Utuh yang menggabungkan beberapa topik pecahan), wajib dimasukkan ke folder "Utuh" (folderName: "Utuh", folderId: null).
2. Cara menentukan 'folderId', 'folderName', dan 'parentFolderName' dalam output JSON:
   - Jika catatan cocok dengan suatu subfolder (misalnya subfolder 'Belanjaan' di bawah parent 'Perusahaan'), isi 'folderId' dengan ID subfolder tersebut dari Daftar Folder, 'folderName' dengan nama subfolder tersebut, dan 'parentFolderName' dengan nama parent foldernya ("Perusahaan").
   - Jika catatan cocok dengan folder induk namun tidak ada subfolder yang spesifik, isi 'folderId' dengan ID folder induk tersebut, 'folderName' dengan nama folder induk tersebut, dan 'parentFolderName' dengan null.
   - Jika tidak ada folder/subfolder yang cocok sama sekali di database namun diperlukan kategori baru, buat subfolder/folder baru dengan mengisi 'folderName' sesuai nama kategori baru tersebut, isi 'folderId' dengan null, dan 'parentFolderName' dengan nama folder induknya (misalnya "Perusahaan", "Polsek", atau "Pribadi") jika kategori baru itu merupakan subkategori.
   - Jika merupakan catatan umum yang tidak memerlukan folder khusus, isi 'folderId': null, 'folderName': null, dan 'parentFolderName': null.
${folderConstraintPrompt}

Kembalikan hasil pemformatan HANYA dalam format JSON dengan skema array berikut:
{
  "notes": [
    {
      "title": "Judul Catatan",
      "content": "Isi catatan yang diformat sangat rapi dengan sub-header, daftar poin/bullet points, tebal, dll. agar nyaman dibaca. Jangan sertakan todo list di dalam 'content' ini.",
      "summary": "Teks transkripsi asli (mentah/verbatim) dari hasil rekaman suara yang bersangkutan dengan catatan ini, tanpa parafrase, pemformatan, atau ringkasan AI.",
      "tags": ["Tag1", "Tag2"],
      "todo_list": ["Tugas 1", "Tugas 2"],
      "folderId": "id-folder-yang-cocok-atau-null",
      "folderName": "NamaFolderBaruAtauNull",
      "parentFolderName": "NamaFolderIndukJikaSubfolderAtauNull"
    }
  ]
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

    let cleanedText = resultText.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(json)?\n?/, '');
      cleanedText = cleanedText.replace(/\n?```$/, '');
      cleanedText = cleanedText.trim();
    }
    const firstBrace = cleanedText.indexOf('{');
    const firstBracket = cleanedText.indexOf('[');
    let start = -1;
    let end = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleanedText.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleanedText.lastIndexOf(']');
    }
    if (start !== -1 && end !== -1 && start < end) {
      cleanedText = cleanedText.substring(start, end + 1);
    }
    const formattedResponse = JSON.parse(cleanedText);

    // If "notes" array is not returned but it returned a single note format, wrap it in notes array
    let finalNotes = [];
    if (formattedResponse.notes && Array.isArray(formattedResponse.notes)) {
      finalNotes = formattedResponse.notes;
    } else if (formattedResponse.title) {
      finalNotes = [formattedResponse];
    } else {
      throw new Error('Format respon AI tidak valid.');
    }

    // Ensure every note in the array has the required attributes
    finalNotes = finalNotes.map((note: any) => ({
      title: note.title || 'Catatan Tanpa Judul',
      content: note.content || '',
      summary: note.summary || text.substring(0, 100) + '...',
      tags: note.tags || [],
      todo_list: note.todo_list || [],
      folderId: note.folderId || null,
      folderName: note.folderName || null,
      parentFolderName: note.parentFolderName || null
    }));

    return NextResponse.json({ notes: finalNotes });
  } catch (error: any) {
    console.error('API Format Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
