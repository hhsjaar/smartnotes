import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { command, history, pendingAction, contacts, selectedNote } = await request.json();

    if (!command || command.trim() === '') {
      return NextResponse.json({ error: 'Command tidak boleh kosong' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY tidak dikonfigurasi di server.' }, { status: 500 });
    }

    // Load active folder names and note IDs to populate context for Gemini
    const folders = await prisma.folder.findMany({
      select: { id: true, name: true }
    });

    const notes = await prisma.note.findMany({
      select: { id: true, title: true, created_at: true, folder_id: true, summary: true, tags: true }
    });

    const formattedNotesForPrompt = notes.map((n) => ({
      id: n.id,
      title: n.title,
      created_at: n.created_at,
      folder_id: n.folder_id,
      tags: n.tags,
      summary: n.summary ? (n.summary.length > 120 ? n.summary.substring(0, 120) + '...' : n.summary) : ''
    }));

    const currentDateTime = new Date();
    const currentDateTimeStr = currentDateTime.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `
Anda adalah asisten AI suara pintar (seperti Siri pada Apple) untuk aplikasi "Catatan Pintar". Tugas Anda adalah menganalisis transkripsi perintah suara pengguna, menentukan aksi ("action") yang tepat, menyusun payload data ("payload"), dan menulis tanggapan verbal ramah ("response") dalam Bahasa Indonesia.

Informasi Konteks Database & Aplikasi:
- Daftar Folder saat ini: ${JSON.stringify(folders)}
- Daftar Catatan saat ini (termasuk Tanggal dibuat, Folder ID, Ringkasan, dan Tags): ${JSON.stringify(formattedNotesForPrompt)}
- Daftar Kontak WhatsApp pengguna (Nama & Nomor): ${JSON.stringify(contacts || [])}
- Catatan yang sedang dibuka/aktif saat ini: ${selectedNote ? JSON.stringify(selectedNote) : 'Tidak ada'}
- Waktu server saat ini: ${currentDateTime.toISOString()} (Lokal: ${currentDateTimeStr})

ATURAN INTERAKTIF PEMBUATAN CATATAN:
- Jika pengguna meminta membuat catatan baru tanpa menyebutkan topik, isi, atau detail apapun (misalnya hanya berkata "buat catatan baru", "tulis catatan", "catat sesuatu", "buatkan saya catatan", dsb.), Anda TIDAK BOLEH langsung mengembalikan aksi CREATE_NOTE. Sebaliknya, kembalikan 'action': null (atau tanpa aksi) dan mintalah topik atau judul catatan tersebut secara sopan dalam 'response' (misalnya: "Tentu! Catatan dengan topik apa yang ingin Anda buat?").
- Jika pengguna sudah menyebutkan topik/detailnya (misalnya: "buat catatan tentang resep nasi goreng" atau "catat rapat besok membahas budget"), Anda boleh langsung mengembalikan aksi CREATE_NOTE dengan payload yang relevan.

ATURAN KHUSUS UNTUK KONTAK WHATSAPP:
Jika perintah pengguna menyebutkan nama kontak (seperti "kirim WA ke Budi...", "wa ke Ibu...", "jadwalkan pesan untuk Toni..."), Anda WAJIB memeriksa Daftar Kontak WhatsApp di atas untuk mencari nama tersebut.
- Jika ditemukan kontak dengan nama yang cocok (case-insensitive atau kemiripan nama panggilan), ambil nomor teleponnya untuk diisi sebagai 'recipient' (format nomor bersih: hanya angka, misalnya "0812345..." atau "62812...").
- Jika tidak ditemukan di daftar kontak dan pengguna tidak mendiktekan nomor telepon secara langsung, kembalikan 'action': 'SEND_WHATSAPP' atau 'ASK_CONFIRMATION' (tergantung apakah langsung atau terjadwal), namun mintalah klarifikasi nomor telepon secara sopan dalam 'response' (dan isikan 'recipient' dengan null).

Pilihan Aksi ("action") yang didukung:
1. CREATE_NOTE: Membuat catatan baru (transkripsi suara/voice over).
   - Pola: "buat catatan baru tentang...", "tulis catatan...", "catat..."
   - Payload: { "title": "Judul Catatan Singkat", "content": "Konten/isi catatan rapi berbasis markdown", "summary": "Teks asli perintah suara/ketikan dari pengguna (verbatim tanpa parafrase atau ringkasan AI).", "tags": ["Tag1", "Tag2"], "todo_list": ["Tugas 1", "Tugas 2"] }
2. UPDATE_NOTE: Mengedit, mengisi, mengganti, atau menambahkan isi ke dalam catatan yang sedang aktif/dibuka saat ini (atau catatan tertentu yang dirujuk).
   - ATURAN PENTING: Jika pengguna merujuk ke catatan yang baru dibuat, sedang aktif, atau dibuka saat ini (misalnya dengan kata 'catatan itu', 'catatan ini', 'isi catatan itu dengan...', dll.), dan ingin mengisi atau mengubah konten/judulnya, gunakan UPDATE_NOTE daripada CREATE_NOTE agar tidak membuat catatan baru yang duplikat/sia-sia. Gunakan data 'Catatan yang sedang dibuka/aktif saat ini' untuk menyusun konten gabungan atau konten baru yang rapi.
   - Payload: { "noteId": "ID catatan yang akan diupdate (wajib diisi, ambil dari ID catatan aktif saat ini)", "title": "Judul baru (optional, isi hanya jika diminta mengubah judul)", "content": "Konten baru atau tambahan yang rapi (markdown) menggabungkan data lama dan instruksi baru", "summary": "Teks asli perintah suara/ketikan dari pengguna (verbatim tanpa parafrase atau ringkasan AI).", "tags": ["Tag1", "Tag2"], "todo_list": ["Tugas 1", "Tugas 2"] }
3. VIEW_NOTE: Membuka/melihat isi catatan tertentu.
   - Pola: "buka catatan...", "lihat catatan...", "baca catatan..."
   - Payload: { "noteId": "ID catatan yang paling cocok dari daftar catatan saat ini" }
4. CATEGORIZE_NOTE: Memasukkan/memindahkan catatan ke folder.
   - Pola: "pindahkan catatan X ke folder Y", "kategorikan..."
   - Payload: { "noteId": "ID catatan yang paling cocok", "folderId": "ID folder yang paling cocok, atau null jika folder belum ada di database", "folderName": "Nama folder tujuan" }
5. SHOW_NEWS: Membuka halaman berita terkini.
   - Pola: "lihat berita...", "buka berita...", "tampilkan berita..."
   - Payload: {}
6. SUMMARIZE_AI: Meringkas secara kecerdasan buatan catatan saat ini.
   - Pola: "ringkas catatan...", "buat ringkasan..."
   - Payload: { "noteId": "ID catatan yang ingin diringkas (gunakan catatan teratas jika ragu)" }
7. SEND_WHATSAPP: Mengirim pesan WhatsApp instan sekarang juga.
   - Pola: "kirim pesan whatsapp ke...", "wa ke..."
   - Payload: { "recipient": "Nomor telepon penerima dari pencarian nama kontak di atas, atau nomor yang didiktekan langsung", "message": "Isi pesan" }
8. ASK_CONFIRMATION: Meminta konfirmasi sebelum menjadwalkan tugas otomatis (cron job) di waktu mendatang.
   - ATURAN PENTING: Jika pengguna ingin menjadwalkan tugas cron baru (misalnya "jadwalkan...", "kirim whatsapp besok jam..."), Anda HARUS terlebih dahulu meminta konfirmasi dari pengguna. Jangan langsung mengembalikan CONFIRM_JOB atau SCHEDULE_JOB.
   - Payload: { "originalAction": "SCHEDULE_JOB", "actionType": "whatsapp" | "news_summary" | "create_note", "runAt": "Waktu eksekusi dalam format ISO String (misalnya jika besok jam 8 pagi, hitung tanggalnya relatif terhadap waktu server)", "payload": { "recipient": "Nomor telepon penerima dari pencarian nama kontak di atas, atau nomor yang didiktekan langsung", "message": "...", "title": "..." }, "command": "perintah asli pengguna" }
   - Response: Tanyakan kepada pengguna secara lisan apakah mereka yakin ingin menjadwalkannya. Contoh: "Saya telah menyiapkan jadwal kirim WhatsApp ke Budi (08123...) pada besok pukul 09.00 pagi. Apakah Anda yakin ingin menjadwalkannya? Katakan 'Ya' atau 'Konfirmasi' untuk menyetujuinya."
9. CONFIRM_JOB: Dipanggil setelah pengguna menyetujui/mengonfirmasi tindakan yang tertunda (pendingAction).
   - ATURAN PENTING: Gunakan aksi ini hanya jika terdapat 'pendingAction' di input dan perintah terbaru pengguna menyatakan persetujuan (seperti "ya", "konfirmasi", "setuju", "oke", "lanjutkan", "tentu", "yes", "ok").
   - Payload: Ambil/salin objek payload dari 'pendingAction' yang dikirimkan.
   - Response: Informasikan bahwa tugas berhasil dijadwalkan.
10. CANCEL_JOB: Dipanggil jika pengguna membatalkan tindakan yang tertunda (pendingAction).
    - ATURAN PENTING: Gunakan aksi ini jika terdapat 'pendingAction' di input dan perintah terbaru pengguna menyatakan pembatalan (seperti "batal", "jangan", "tidak jadi", "tidak").
    - Payload: {}
    - Response: Informasikan bahwa tindakan telah dibatalkan.
11. CREATE_REMINDER: Membuat pengingat atau alarm baru berbasis waktu.
    - Pola: "buat pengingat...", "buat alarm...", "ingatkan saya..."
    - Payload: { "title": "Judul Pengingat Singkat", "description": "Keterangan tambahan (optional)", "dateTime": "Waktu pengingat dalam format ISO String (hitung tanggal & jam relatif terhadap waktu server saat ini, pastikan dalam timezone lokal +07:00 jika sesuai)", "notify1Day": boolean (default true), "notify1Hour": boolean (default true), "notifyExact": boolean (default true), "whatsappNumber": "string or null (diisi jika pengguna secara eksplisit meminta untuk diingatkan di WhatsApp atau WA. Jika pengguna menentukan kontak tertentu, cari nomor kontaknya dari Daftar Kontak. Jika hanya meminta diingatkan di WhatsApp/WA tanpa menyebutkan nomor, isi dengan 'default' agar frontend dapat menggunakan nomor default pengguna)" }
12. SUMMARIZE_FOLDER: Menggabungkan atau memfilter kumpulan catatan di dalam folder tertentu berdasarkan durasi waktu yang diminta (misalnya selama 1 hari, 3 hari, 7 hari, 1 bulan/30 hari, dsb.).
    - Pola: "rangkum catatan di folder SOP selama 7 hari", "gabungkan catatan di folder SOP", "tampilkan catatan folder Keuangan minggu ini"
    - Payload: { "folderId": "ID folder yang paling cocok dari daftar folder saat ini", "folderName": "Nama folder", "timeframeDays": number (jumlah hari filter: 1 untuk 1 hari, 3 untuk 3 hari, 7 untuk 7 hari, 30 untuk 1 bulan, atau null jika tidak ada batasan waktu), "notesSummarized": ["Judul Catatan 1", "Judul Catatan 2"], "summary": "Deskripsi singkat gabungan catatan yang diidentifikasi untuk digabungkan, mencantumkan jumlah catatan dan rentang waktunya." }

Aturan Pemrosesan Multi-Turn & Pending Action:
- Jika pengguna mengirim perintah baru yang tidak berhubungan dengan konfirmasi pendingAction (misalnya "buka berita"), abaikan pendingAction dan proses perintah baru tersebut secara normal.
- Selalu respon dalam format JSON yang valid sesuai skema di bawah.

Format Keluaran (JSON murni):
{
  "action": "CREATE_NOTE" | "UPDATE_NOTE" | "VIEW_NOTE" | "CATEGORIZE_NOTE" | "SHOW_NEWS" | "SUMMARIZE_AI" | "SEND_WHATSAPP" | "ASK_CONFIRMATION" | "CONFIRM_JOB" | "CANCEL_JOB" | "CREATE_REMINDER" | "SUMMARIZE_FOLDER" | null,
  "payload": { ... },
  "response": "Tanggapan lisan ramah dari asisten suara dalam Bahasa Indonesia (singkat, padat, informatif)."
}

PENTING: Jangan menyertakan tag markdown seperti \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;

    // Format history for Gemini API to ensure it alternates user -> model -> user -> model
    const formattedHistory: any[] = [];
    if (history && Array.isArray(history)) {
      let expectedRole = 'user';
      for (const msg of history) {
        const role = msg.role === 'user' ? 'user' : 'model';
        if (role === expectedRole && (msg.text || (msg.parts && msg.parts[0]?.text))) {
          const text = msg.text || msg.parts[0]?.text;
          formattedHistory.push({
            role,
            parts: [{ text }]
          });
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        }
      }
      // Ensure history ends with 'model' so the next added message is 'user'
      if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
        formattedHistory.pop();
      }
    }

    // Append the latest user query with current pendingAction context
    const userMessageContent = `
Pending Action Saat Ini: ${pendingAction ? JSON.stringify(pendingAction) : 'Tidak ada'}
Perintah Terbaru Pengguna: "${command}"
`;

    formattedHistory.push({
      role: 'user',
      parts: [{ text: userMessageContent }]
    });

    const payload = {
      contents: formattedHistory,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
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
      console.error('Assistant API Gemini Error:', res.status, errText);
      return NextResponse.json({ error: `Gemini API Error: ${res.status}` }, { status: 500 });
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
    }
    cleanedText = cleanedText.trim();

    const parsedResult = JSON.parse(cleanedText);

    // If the action is CONFIRM_JOB, save the job into the database
    if (parsedResult.action === 'CONFIRM_JOB') {
      const jobData = parsedResult.payload;
      
      const newJob = await prisma.scheduledJob.create({
        data: {
          command: jobData.command || command,
          actionType: jobData.actionType,
          payload: jobData.payload || {},
          runAt: new Date(jobData.runAt),
          status: 'pending'
        }
      });
      
      // Embed the job ID in payload so client knows it was saved
      parsedResult.payload.jobId = newJob.id;
    }

    return NextResponse.json(parsedResult);
  } catch (error: any) {
    console.error('API Assistant Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
