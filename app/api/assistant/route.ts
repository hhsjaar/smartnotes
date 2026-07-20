import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function callGemini(apiKey: string, contents: any[], systemPrompt: string, responseJson = true) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
  const payload: any = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    }
  };
  if (responseJson) {
    payload.generationConfig = {
      responseMimeType: 'application/json'
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }
  return text;
}

function cleanJsonString(str: string): string {
  let result = '';
  let inString = false;
  let escape = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === '"' && !escape) {
      inString = !inString;
    }
    
    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    
    if (char === '\\' && !escape) {
      escape = true;
    } else {
      escape = false;
    }
  }
  return result;
}

function robustJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn("Standard JSON.parse failed, trying cleaned string...", err);
    try {
      const cleaned = cleanJsonString(text);
      return JSON.parse(cleaned);
    } catch (err2) {
      console.error("Cleaned JSON.parse also failed:", err2);
      throw err2;
    }
  }
}

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

    // Fetch database context concurrently using Promise.all
    const [
      chatRoomMessages,
      allFolders,
      notes,
      chatAttributes,
      chatAttributeHistories,
      reservationsList
    ] = await Promise.all([
      prisma.chatMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.folder.findMany({ select: { id: true, name: true, parentId: true } }),
      prisma.note.findMany({ select: { id: true, title: true, created_at: true, folder_id: true, summary: true, tags: true } }),
      prisma.chatAttribute.findMany({ orderBy: { name: 'asc' } }),
      prisma.chatAttributeHistory.findMany({ orderBy: { recordedAt: 'desc' }, take: 50 }),
      prisma.reservation.findMany({ orderBy: { dateTime: 'asc' } })
    ]);

    const chatRoomMessagesChronological = [...chatRoomMessages].reverse();
    const formattedChatRoomMessagesText = chatRoomMessagesChronological.map(msg => 
      `[${msg.createdAt.toISOString()}] ${msg.senderName} (${msg.senderRole}) [Atribut: ${msg.attribute || 'Umum'}]: ${msg.message}`
    ).join('\n');

    const rootFolders = allFolders.filter(f => !f.parentId && f.name.toLowerCase() !== 'utuh');
    const folderNamesStr = rootFolders.map(f => f.name).join(', ') + ', atau Tanpa Folder';

    const formattedNotesForPrompt = notes.map((n) => ({
      id: n.id,
      title: n.title,
      created_at: n.created_at,
      folder_id: n.folder_id,
      tags: n.tags,
      summary: n.summary ? (n.summary.length > 120 ? n.summary.substring(0, 120) + '...' : n.summary) : ''
    }));

    // Fetch and format Chat Attributes (Tugas/Jobdesk)
    const formattedAttributesListText = chatAttributes.map(attr => {
      const opts = Array.isArray(attr.options) ? (attr.options as any[]) : [];
      const timeframeOpts = opts.filter(o => o.hasTimeframe);
      if (timeframeOpts.length === 0) return `- Atribut "${attr.name}": Tidak ada tugas jangka waktu.`;
      
      const optDetails = timeframeOpts.map(o => {
        const isTaken = o.status === 'taken';
        const expiryStr = o.expiryDate ? new Date(o.expiryDate).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';
        return `  * Tugas/Jobdesk: "${o.text}" | Status: ${isTaken ? `Diambil oleh ${o.assignedTo}` : 'Ready (Belum Diambil)'} | Durasi: ${o.duration || '1 hari'} | Berakhir/Deadline: ${expiryStr}`;
      }).join('\n');
      return `- Atribut "${attr.name}":\n${optDetails}`;
    }).join('\n');

    // Fetch and format Chat Attribute Histories
    const formattedAttributeHistoriesText = chatAttributeHistories.map(h => {
      const timeStr = new Date(h.recordedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const statusLabel = h.status === 'taken' ? `Diambil/Selesai oleh ${h.assignedTo || '-'}` : 'Hangus (Tidak Diambil)';
      return `[${timeStr}] Atribut: "${h.attributeName}" | Tugas: "${h.optionText}" | Hasil/Status: ${statusLabel} | Periode: ${new Date(h.startDate).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} s/d ${new Date(h.expiryDate).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
    }).join('\n') || 'Belum ada riwayat aktivitas tugas atribut.';

    // Fetch and format customer reservations
    const formattedReservationsText = reservationsList.map(r => {
      const date = new Date(r.dateTime);
      const formattedDate = date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `- [Status: ${r.status}] Nama: ${r.name} | Tanggal & Jam: ${formattedDate} | Meja: ${r.tableInfo} | Jumlah Orang: ${r.partySize} orang | DP: Rp ${r.dpAmount.toLocaleString('id-ID')} | Menu Pesanan: ${r.menuList || '-'}`;
    }).join('\n');

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

    // Check if user is requesting a reservation table note to be built
    const lowerCommand = command.toLowerCase();
    const isReservationTableRequest = 
      lowerCommand.includes('tabel reservasi') || 
      (lowerCommand.includes('buat') && lowerCommand.includes('reservasi') && lowerCommand.includes('tabel')) ||
      (lowerCommand.includes('buatkan') && lowerCommand.includes('reservasi') && lowerCommand.includes('tabel'));

    if (isReservationTableRequest) {
      let tableContent = `# Tabel Reservasi Pelanggan Burjolevelup\n\n`;
      tableContent += `Dibuat otomatis oleh AI Asisten Suara pada: ${currentDateTimeStr}\n\n`;
      tableContent += `| Nama Pelanggan | Tanggal & Jam Booking | Meja / Tempat | Jumlah Orang | DP Pembayaran | Menu Pesanan | Status |\n`;
      tableContent += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      reservationsList.forEach((r: any) => {
        const date = new Date(r.dateTime);
        const formattedDate = date.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        const dpFormatted = r.dpAmount > 0 ? `Rp ${r.dpAmount.toLocaleString('id-ID')}` : 'Tidak Ada / Rp 0';
        const menuStr = r.menuList ? r.menuList.replace(/\n/g, ' ') : '-';
        const statusLabels: Record<string, string> = {
          pending: 'Menunggu ⏳',
          confirmed: 'Dikonfirmasi ✅',
          completed: 'Selesai 🏁',
          cancelled: 'Dibatalkan ❌'
        };
        const statusLabel = statusLabels[r.status] || r.status;
        tableContent += `| ${r.name} | ${formattedDate} | ${r.tableInfo} | ${r.partySize} orang | ${dpFormatted} | ${menuStr} | ${statusLabel} |\n`;
      });

      return NextResponse.json({
        action: 'CREATE_NOTE_DIRECT',
        payload: {
          title: `Tabel Reservasi - ${currentDateTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
          content: tableContent,
          summary: `Membuat catatan tabel dari daftar reservasi aktif.`,
          todo_list: [],
          tags: ['Reservasi', 'Tabel', 'Otomatis'],
          folderId: null
        },
        response: `Baik, saya telah membaca seluruh data reservasi di database dan membuatkan catatan tabel reservasi pelanggan terbaru untuk Anda.`
      });
    }

    // 1. Classifier to check if this is a request for a meeting draft
    const classifierPrompt = `
Analyze the user's latest command and the conversation history to determine if they are requesting a meeting draft (Draft Pembahasan Rapat).
Current folders available: ${JSON.stringify(allFolders.map(f => ({ id: f.id, name: f.name })))}
Current server time: ${currentDateTime.toISOString()} (Local: ${currentDateTimeStr})

You must return a JSON object with this exact structure:
{
  "isDraftRequest": true,
  "folderName": "Perusahaan",
  "source": "folder",
  "timeframe": {
    "start": "2026-07-01T00:00:00.000Z",
    "end": "2026-07-20T23:59:59.999Z",
    "raw": "dari 1 sampai 20 juli"
  },
  "missingInfo": []
}

Rules for fields in the JSON object:
1. "isDraftRequest" must be true if the user's query contains requests for "draf rapat", "draft rapat", "draf pembahasan", "draft pembahasan", "buat draf", "materi rapat", "bahan rapat", "siapkan draf", "tulis draf", "menyusun draf", or similar meeting draft phrases, OR if they are answering follow-up questions about it.
2. "source" must be "chat" if the user explicitly requests to create a draft from "chat room", "grup chat", "chat karyawan", "obrolan", or "percakapan". Otherwise, it must be "folder".
3. "folderName" must be the matched folder name (e.g. "Perusahaan", "Polsek", etc.) from the available folders. If source is "chat", folderName can be null. Do NOT match "Rapat" or "rapat" as folderName if the word "rapat" in the command is just part of general action phrases like "draf pembahasan rapat", "draf rapat", "buat draf rapat", or "materi rapat". Only set folderName as "Rapat" if the user explicitly specifies "folder Rapat" or "catatan di dalam folder rapat".
4. "timeframe" contains "start" (ISO string of start date), "end" (ISO string of end date), and "raw" (raw text like "2 minggu"). If timeframe is unknown, use null.
5. "missingInfo" is an array of strings. If source is "folder" and folder name is not specified/matched, include "folder". If timeframe is unknown, include "timeframe". If source is "chat", do NOT require folder, so "folder" should NOT be in missingInfo.

Examples of draft requests (which must return isDraftRequest: true):
- "buat draf rapat untuk folder Perusahaan" -> folderName: "Perusahaan", source: "folder", missingInfo: ["timeframe"]
- "buat draf rapat berdasarkan chat karyawan" -> folderName: null, source: "chat", missingInfo: ["timeframe"]
- "tulis draft rapat polsek dari 1 juni sampai sekarang" -> folderName: "Polsek", source: "folder", missingInfo: []
- "buat draf rapat dari chat room untuk 2 minggu terakhir" -> folderName: null, source: "chat", missingInfo: []

Rules for date parsing:
- The current year is 2026.
- If the user says "2 minggu" or "2 minggu ke belakang", calculate start as current time minus 14 days, and end as current time.
- If the user says "dari tanggal 1-20 juli", calculate start as 2026-07-01T00:00:00.000Z and end as 2026-07-20T23:59:59.999Z.
- Adjust start/end dates correctly according to the Indonesian description of dates/durations.
- Ensure dates are valid ISO-8601 strings.
`;

    interface ClassifierResult {
      isDraftRequest: boolean;
      folderName: string | null;
      source: 'folder' | 'chat';
      timeframe: {
        start: string | null;
        end: string | null;
        raw: string | null;
      } | null;
      missingInfo: string[];
    }

    let classifierResult: ClassifierResult = { 
      isDraftRequest: false, 
      folderName: null,
      source: 'folder',
      timeframe: null, 
      missingInfo: [] 
    };
    try {
      const classifierText = await callGemini(apiKey, formattedHistory, classifierPrompt, true);
      let cleanedClassifierText = classifierText.trim();
      if (cleanedClassifierText.startsWith('```')) {
        cleanedClassifierText = cleanedClassifierText.replace(/^```(json)?\n?/, '');
        cleanedClassifierText = cleanedClassifierText.replace(/\n?```$/, '');
      }
      cleanedClassifierText = cleanedClassifierText.trim();

      // Robust JSON substring extraction
      const firstBrace = cleanedClassifierText.indexOf('{');
      const lastBrace = cleanedClassifierText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        cleanedClassifierText = cleanedClassifierText.substring(firstBrace, lastBrace + 1);
      }

      // Strip trailing commas before closing braces/brackets
      cleanedClassifierText = cleanedClassifierText.replace(/,\s*([\]}])/g, '$1');

      classifierResult = robustJsonParse(cleanedClassifierText);
    } catch (err) {
      console.error('Failed to classify voice command:', err);
    }

    // Heuristic Fallback for Draft Pembahasan Rapat
    const hasDraftKeyword = lowerCommand.includes('draft') || lowerCommand.includes('draf');
    const hasMeetingKeyword = lowerCommand.includes('rapat') || lowerCommand.includes('pembahasan') || lowerCommand.includes('mitigasi') || lowerCommand.includes('agenda') || lowerCommand.includes('bahan');

    if (hasDraftKeyword && hasMeetingKeyword) {
      classifierResult.isDraftRequest = true;

      // Extract folder name if missing
      if (!classifierResult.folderName) {
        const foundFolder = allFolders.find(f => {
          const nameLower = f.name.toLowerCase();
          // If the folder is named 'rapat', only match if the command explicitly contains 'folder rapat'
          if (nameLower === 'rapat') {
            return lowerCommand.includes('folder rapat');
          }
          return lowerCommand.includes(nameLower);
        });
        if (foundFolder) {
          classifierResult.folderName = foundFolder.name;
          if (classifierResult.missingInfo) {
            classifierResult.missingInfo = classifierResult.missingInfo.filter(x => x !== 'folder');
          }
        } else {
          classifierResult.missingInfo = classifierResult.missingInfo || [];
          if (!classifierResult.missingInfo.includes('folder')) {
            classifierResult.missingInfo.push('folder');
          }
        }
      }

      // Extract timeframe if missing or invalid
      if (!classifierResult.timeframe || !classifierResult.timeframe.start || !classifierResult.timeframe.end) {
        let days = 14;
        let rawText = '2 minggu terakhir';

        if (lowerCommand.includes('1 minggu') || lowerCommand.includes('seminggu') || lowerCommand.includes('7 hari')) {
          days = 7;
          rawText = '1 minggu terakhir';
        } else if (lowerCommand.includes('3 minggu') || lowerCommand.includes('21 hari')) {
          days = 21;
          rawText = '3 minggu terakhir';
        } else if (lowerCommand.includes('1 bulan') || lowerCommand.includes('sebulan') || lowerCommand.includes('30 hari')) {
          days = 30;
          rawText = '1 bulan terakhir';
        }

        const end = new Date();
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

        classifierResult.timeframe = {
          start: start.toISOString(),
          end: end.toISOString(),
          raw: classifierResult.timeframe?.raw || rawText
        };

        if (classifierResult.missingInfo) {
          classifierResult.missingInfo = classifierResult.missingInfo.filter(x => x !== 'timeframe');
        }
      }
    }

    if (classifierResult.isDraftRequest) {
      const missing = classifierResult.missingInfo || [];
      const folderName = classifierResult.folderName;
      const timeframe = classifierResult.timeframe;

      // If either folder or timeframe is missing, ask for it
      const isFolderRequired = classifierResult.source !== 'chat';
      const isFolderMissing = isFolderRequired && (missing.includes('folder') || !folderName);

      if (isFolderMissing || missing.includes('timeframe') || !timeframe || !timeframe.start || !timeframe.end) {
        let response = '';
        if (isFolderMissing && (missing.includes('timeframe') || !timeframe)) {
          response = 'Tentu! Folder mana yang ingin Anda gunakan sebagai referensi pembahasan rapat? Dan untuk jangka waktu catatan berapa lama? (misalnya: folder "Perusahaan" untuk catatan "2 minggu terakhir")';
        } else if (isFolderMissing) {
          response = 'Tentu, saya bisa bantu. Folder mana yang ingin Anda gunakan sebagai referensi pembahasan rapat?';
        } else {
          if (classifierResult.source === 'chat') {
            response = `Baik, untuk laporan dari chat room, jangka waktu berapa lama yang ingin digunakan? (misalnya: 1 minggu terakhir, atau dari tanggal 1-20 Juli)`;
          } else {
            response = `Baik, untuk catatan di folder "${folderName}", dari jangka waktu berapa lama yang ingin digunakan? (misalnya: dari tanggal 1-20 Juli, atau 2 minggu terakhir)`;
          }
        }
        return NextResponse.json({
          action: null,
          payload: {},
          response
        });
      }

      // Handle Chat Room Draft Generation
      if (classifierResult.source === 'chat') {
        let startDate = new Date(timeframe.start);
        let endDate = new Date(timeframe.end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          endDate = new Date();
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        const chatMsgs = await prisma.chatMessage.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          orderBy: { createdAt: 'asc' }
        });

        if (chatMsgs.length === 0) {
          return NextResponse.json({
            action: null,
            payload: {},
            response: `Saya tidak menemukan laporan/pesan chat apa pun di chat room untuk rentang waktu ${timeframe.raw || 'tersebut'}. Silakan coba dengan rentang waktu lain.`
          });
        }

        const formattedChatText = chatMsgs.map((c, i) => {
          const formattedDate = new Date(c.createdAt).toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          return `[Pesan #${i + 1}] Waktu: ${formattedDate} | Pengirim: ${c.senderName} (${c.senderRole}) | Atribut: ${c.attribute || 'Umum'}\nIsi Pesan: ${c.message}\n`;
        }).join('\n');

        const draftPrompt = `
Anda adalah asisten AI suara pintar untuk aplikasi "Catatan Pintar". Anda adalah seorang leader/pemimpin rapat yang ingin menyusun draf rapat secara profesional, sangat detail, lengkap, faktual, dan terstruktur berdasarkan percakapan chat karyawan dan admin di chat room.

Tugas Anda adalah membuat "Draft Pembahasan Rapat dari Grup Chat" untuk rentang waktu "${timeframe.raw}". Anda wajib menganalisis dan menguraikan SELURUH pesan chat koordinasi/laporan di bawah ini. Uraikan apa saja kendala, laporan sales, progres, atau masalah mendesak yang dilaporkan karyawan.

Berikut adalah daftar percakapan chat di database:
${formattedChatText}

Struktur Dokumen (Format Markdown Konten):
Dokumen draf rapat Anda wajib menggunakan format Markdown dengan tabel yang rapi dan informatif sebagai berikut:

# Draf Pembahasan Rapat: Laporan Grup Chat (${timeframe.raw})

## 1. Uraian Laporan Koordinasi (Dikelompokkan Berdasarkan Atribut)
Uraikan secara detail pesan chat yang ada, kelompokkan berdasarkan klasifikasi atribut (misalnya: Sales, Progres, Umum, Urgent, dll):

| Atribut | Pengirim | Waktu | Laporan / Informasi (Faktual & Detail) | Rekomendasi Tindak Lanjut / Mitigasi Admin |
| :--- | :--- | :--- | :--- | :--- |
| [Atribut] | [Nama Karyawan] | [Tanggal & Jam] | [Uraikan secara detail isi laporan chat] | [Uraikan rekomendasi penyelesaian/mitigasi atau tanggapan admin yang tepat untuk laporan ini] |

## 2. Agenda Rapat Pemimpin (Berdasarkan Laporan Penting Karyawan)
Buatlah agenda rapat yang harus dipimpin berdasarkan laporan-laporan dari chat room tersebut:

| Agenda Rapat | Poin Bahasan Utama | Urgensi Pembahasan | Rencana Aksi / Mitigasi Pencegahan |
| :--- | :--- | :--- | :--- |
| **Agenda [No]**: [Nama Topik] | [Poin bahasan] | [Kenapa ini mendesak dibahas berdasarkan chat] | [Rencana aksi nyata untuk menyelesaikan masalah] |

## 3. Proyeksi Operasional & Rekomendasi Solutif
Analisis kumpulan data pesan chat koordinasi/laporan karyawan di atas untuk merumuskan proyeksi operasional ke depan secara konkret, solutif, dan berbasis data rujukan (seperti kekompakan tim, kepatuhan SOP, koordinasi antar divisi, kondisi gudang/stok, atau temuan lainnya). Gunakan format tabel Markdown berikut:

| Bidang Proyeksi | Analisis Proyeksi & Solusi Konkret | Data Rujukan (Pengirim, Waktu & Temuan Kunci) |
| :--- | :--- | :--- |
| [Misalnya: Kekompakan / SOP / Koordinasi / Gudang / dll.] | [Uraikan analisis proyeksi ke depan yang solutif, konstruktif, dan konkret untuk meningkatkan performa operasional bisnis.] | [Sebutkan nama pengirim, waktu chat, dan data/fakta spesifik dari pesan chat yang mendasari analisis ini sebagai rujukan konkret.] |

---

Format Keluaran (JSON murni):
{
  "title": "Draf Pembahasan Rapat - Grup Chat (${timeframe.raw})",
  "content": "[Tuliskan seluruh isi draf rapat detail dengan format Markdown di atas di sini]",
  "summary": "[Ringkasan singkat draf pembahasan rapat dalam 1-2 kalimat]",
  "todo_list": ["[Tugas Mitigasi 1]", "[Tugas Mitigasi 2]"],
  "tags": ["Rapat", "Draft", "ChatRoom"]
}

Aturan Penting:
1. Pastikan isi "content" memuat draf dalam bahasa Indonesia yang formal, berwibawa, dan sangat detail.
2. Jangan menggunakan tag markdown pembungkus json seperti \`\`\`json pada output. Kembalikan string JSON murni yang valid.
3. PENTING: Jangan menyisipkan baris kosong (blank line/double newline) di antara baris-baris tabel Markdown agar dapat dirender dengan benar.
`;

        try {
          const draftResultText = await callGemini(apiKey, [{ role: 'user', parts: [{ text: 'Mulai pembuatan draf rapat dari chat' }] }], draftPrompt, true);
          let cleanedDraftText = draftResultText.trim();
          if (cleanedDraftText.startsWith('```')) {
            cleanedDraftText = cleanedDraftText.replace(/^```(json)?\n?/, '');
            cleanedDraftText = cleanedDraftText.replace(/\n?```$/, '');
          }
          cleanedDraftText = cleanedDraftText.trim();

          const firstBrace = cleanedDraftText.indexOf('{');
          const lastBrace = cleanedDraftText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            cleanedDraftText = cleanedDraftText.substring(firstBrace, lastBrace + 1);
          }
          cleanedDraftText = cleanedDraftText.replace(/,\s*([\]}])/g, '$1');

          const generatedDraft = robustJsonParse(cleanedDraftText);

          // Find or create "Perusahaan" folder
          let parentFolder = await prisma.folder.findFirst({
            where: { name: { equals: 'Perusahaan', mode: 'insensitive' } }
          });
          if (!parentFolder) {
            parentFolder = await prisma.folder.create({
              data: { name: 'Perusahaan' }
            });
          }

          // Find or create "Utuh" subfolder
          let targetFolderId = parentFolder.id;
          const utuhSubfolder = await prisma.folder.findFirst({
            where: { parentId: parentFolder.id, name: { equals: 'Utuh', mode: 'insensitive' } }
          });
          if (utuhSubfolder) {
            targetFolderId = utuhSubfolder.id;
          } else {
            const newUtuhFolder = await prisma.folder.create({
              data: {
                name: 'Utuh',
                parentId: parentFolder.id
              }
            });
            targetFolderId = newUtuhFolder.id;
          }

          return NextResponse.json({
            action: 'CREATE_NOTE_DIRECT',
            payload: {
              title: generatedDraft.title,
              content: generatedDraft.content,
              summary: generatedDraft.summary,
              todo_list: generatedDraft.todo_list,
              tags: generatedDraft.tags,
              folderId: targetFolderId
            },
            response: `Saya telah menganalisis ${chatMsgs.length} pesan dari chat room grup dan berhasil membuat draf rapat. Catatan draf rapat baru telah disimpan di sub-folder "Utuh" dalam folder "Perusahaan".`
          });
        } catch (draftErr: any) {
          console.error('Error generating meeting draft from chat:', draftErr);
          return NextResponse.json({
            error: 'Gagal membuat draf pembahasan rapat dari chat menggunakan AI.'
          }, { status: 500 });
        }
      }

      if (!folderName) {
        return NextResponse.json({
          action: null,
          payload: {},
          response: 'Nama folder referensi tidak boleh kosong.'
        });
      }

      // Try to find the folder in the DB
      const matchedFolder = allFolders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
      if (!matchedFolder) {
        return NextResponse.json({
          action: null,
          payload: {},
          response: `Maaf, saya tidak menemukan folder dengan nama "${folderName}". Pilihan folder yang tersedia adalah: ${folderNamesStr}. Silakan sebutkan folder yang ingin digunakan.`
        });
      }

      // Fetch children subfolders
      const childFolderIds = allFolders
        .filter(f => f.parentId === matchedFolder.id)
        .map(f => f.id);
      const allowedFolderIds = [matchedFolder.id, ...childFolderIds];

      let startDate = new Date(timeframe.start);
      let endDate = new Date(timeframe.end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        endDate = new Date();
        startDate = new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      }

      // Fetch matching notes
      const matchedNotes = await prisma.note.findMany({
        where: {
          folder_id: { in: allowedFolderIds },
          created_at: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true,
          title: true,
          content: true,
          created_at: true,
          folder_id: true
        }
      });

      if (matchedNotes.length === 0) {
        return NextResponse.json({
          action: null,
          payload: {},
          response: `Saya tidak menemukan catatan apa pun di folder "${matchedFolder.name}" untuk rentang waktu ${timeframe.raw || 'tersebut'}. Silakan coba dengan folder atau jangka waktu lain.`
        });
      }

      // Format notes matching with subfolder names
      const formattedMatchedNotesText = matchedNotes.map((n, i) => {
        const folderName = allFolders.find(f => f.id === n.folder_id)?.name || 'ROOT';
        const formattedDate = new Date(n.created_at).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        return `
--- CATATAN #${i + 1} ---
Judul: ${n.title}
Folder/Subfolder: ${folderName}
Tanggal Dibuat: ${formattedDate}
Konten:
${n.content}
`;
      }).join('\n');

      // Generate the meeting draft
      const draftPrompt = `
Anda adalah asisten AI suara pintar untuk aplikasi "Catatan Pintar". Anda adalah seorang leader/pemimpin rapat yang ingin menyusun draf rapat secara profesional, sangat detail, lengkap, faktual, dan terstruktur berdasarkan database catatan kami.

Tugas Anda adalah membuat "Draft Pembahasan Rapat" dari folder induk "${matchedFolder.name}" untuk rentang waktu "${timeframe.raw}". Anda wajib menganalisis dan menguraikan SELURUH catatan referensi yang kami sediakan di bawah ini. Jangan membuang, mengabaikan, atau mempersingkat catatan yang ada secara drastis. Buatlah draf rapat yang komprehensif dan faktual sesuai data di database.

Berikut adalah daftar catatan referensi yang ditemukan di database untuk folder "${matchedFolder.name}":
${formattedMatchedNotesText}

Struktur Dokumen (Format Markdown Konten):
Dokumen draf rapat Anda wajib menggunakan format Markdown dengan tabel yang sangat rapi dan informatif sebagai berikut:

# Draf Pembahasan Rapat: ${matchedFolder.name} (${timeframe.raw})

## 1. Uraian Referensi Bahan Rapat (Berdasarkan Subfolder)
Gunakan format tabel Markdown berikut untuk menguraikan seluruh catatan referensi satu persatu, dikelompokkan dan diurutkan berdasarkan subfolder:

| Subfolder | Judul Catatan | Waktu Dibuat | Uraian Isi Catatan (Faktual & Detail) | Mitigasi / Rekomendasi Penanggulangan (Kontekstual & Adaptif) |
| :--- | :--- | :--- | :--- | :--- |
| [Nama Subfolder] | [Judul Catatan] | [Hari, Tanggal, Jam Dibuat] | [Uraikan secara sangat detail, lengkap, dan faktual isi pembicaraan/laporan dari catatan ini. Paparkan semua data konkret seperti angka, nama orang, lokasi, dan kejadian. Jangan disingkat secara membingungkan.] | [Analisis penyebab masalah dan uraikan rekomendasi mitigasi atau langkah korektif instan yang sesuai untuk temuan catatan ini. Sesuaikan analisis mitigasi ini dengan konteks operasional dari catatan tersebut secara cerdas (misalnya: jika catatan membahas restoran/warung gunakan konteks bisnis Food & Beverage seperti standar kebersihan, kepekaan karyawan, higiene; jika membahas Polsek gunakan konteks keamanan/ketertiban masyarakat; jika membahas korporat/instansi gunakan konteks efisiensi kerja, tata kelola, dan kebijakan kantor; jika catatan pribadi gunakan konteks pengembangan diri atau manajemen personal).] |

## 2. Draft Materi Rapat (Agenda Pembahasan Pemimpin)
Gunakan format tabel Markdown berikut untuk menyusun agenda pembahasan rapat yang akan dipimpin oleh leader:

| Agenda Rapat | Poin Bahasan | Alasan Pembahasan (Urgensi) | Langkah Mitigasi & Pencegahan |
| :--- | :--- | :--- | :--- |
| **Agenda [No]**: [Nama Topik/Agenda] | [Poin spesifik yang dibahas] | [Uraikan secara detail alasan kenapa topik ini perlu dibahas dalam rapat berdasarkan data catatan] | [Uraikan langkah-langkah mitigasi yang sesuai dan tindakan konkret untuk memperbaiki masalah tersebut serta mencegah terulangnya kendala di masa depan] |

## 3. Proyeksi Operasional & Rekomendasi Solutif
(Bab ini WAJIB diisi jika folder yang dibahas adalah "Perusahaan" atau berkaitan dengan aktivitas perusahaan). Analisis kumpulan data catatan referensi di atas untuk merumuskan proyeksi operasional ke depan secara konkret, solutif, dan berbasis data rujukan (seperti kekompakan tim, kepatuhan SOP, koordinasi antar divisi, kondisi gudang/stok, atau temuan operasional lainnya). Gunakan format tabel Markdown berikut:

| Bidang Proyeksi | Analisis Proyeksi & Solusi Konkret | Data Rujukan (Judul Catatan & Temuan Kunci) |
| :--- | :--- | :--- |
| [Misalnya: Kekompakan / SOP / Koordinasi / Gudang / dll.] | [Uraikan analisis proyeksi ke depan yang solutif, konstruktif, dan konkret untuk meningkatkan performa bisnis.] | [Sebutkan judul catatan rujukan dan data/angka/fakta spesifik dari catatan tersebut yang mendasari analisis ini sebagai rujukan konkret.] |

---

Format Keluaran (JSON murni):
{
  "title": "Draf Pembahasan Rapat - ${matchedFolder.name} (${timeframe.raw})",
  "content": "[Tuliskan seluruh isi draf rapat detail dengan format Markdown di atas di sini]",
  "summary": "[Ringkasan singkat draf pembahasan rapat dalam 1-2 kalimat]",
  "todo_list": ["[Tugas Mitigasi 1]", "[Tugas Mitigasi 2]"],
  "tags": ["Rapat", "Draft", "${matchedFolder.name}"]
}

Aturan Penting:
1. Pastikan isi "content" memuat draf dalam bahasa Indonesia yang formal, berwibawa, dan sangat detail.
2. Jangan menggunakan tag markdown pembungkus json seperti \`\`\`json pada output. Kembalikan string JSON murni yang valid.
3. PENTING: Jangan menyisipkan baris kosong (blank line/double newline) di antara baris-baris tabel Markdown. Baris header, baris pembatas alignment (:---), dan semua baris isi tabel harus ditulis rapat berurutan tanpa dipisahkan oleh baris kosong, agar tabel dapat dirender secara visual dengan benar oleh parser markdown.
`;

      try {
        const draftResultText = await callGemini(apiKey, [{ role: 'user', parts: [{ text: 'Mulai pembuatan draf rapat' }] }], draftPrompt, true);
        let cleanedDraftText = draftResultText.trim();
        if (cleanedDraftText.startsWith('```')) {
          cleanedDraftText = cleanedDraftText.replace(/^```(json)?\n?/, '');
          cleanedDraftText = cleanedDraftText.replace(/\n?```$/, '');
        }
        cleanedDraftText = cleanedDraftText.trim();

        // Robust JSON substring extraction
        const firstBrace = cleanedDraftText.indexOf('{');
        const lastBrace = cleanedDraftText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
          cleanedDraftText = cleanedDraftText.substring(firstBrace, lastBrace + 1);
        }

        // Strip trailing commas before closing braces/brackets if any, to avoid JSON parse errors
        cleanedDraftText = cleanedDraftText.replace(/,\s*([\]}])/g, '$1');

        const generatedDraft = robustJsonParse(cleanedDraftText);

        // Find or create "Utuh" subfolder inside matchedFolder
        let targetFolderId = matchedFolder.id;
        const utuhSubfolder = allFolders.find(
          f => f.parentId === matchedFolder.id && f.name.toLowerCase() === 'utuh'
        );
        if (utuhSubfolder) {
          targetFolderId = utuhSubfolder.id;
        } else {
          const newUtuhFolder = await prisma.folder.create({
            data: {
              name: 'Utuh',
              parentId: matchedFolder.id
            }
          });
          targetFolderId = newUtuhFolder.id;
        }

        return NextResponse.json({
          action: 'CREATE_NOTE_DIRECT',
          payload: {
            title: generatedDraft.title,
            content: generatedDraft.content,
            summary: generatedDraft.summary,
            todo_list: generatedDraft.todo_list,
            tags: generatedDraft.tags,
            folderId: targetFolderId
          },
          response: `Saya telah menganalisis ${matchedNotes.length} catatan dari folder "${matchedFolder.name}" dan membuat draf rapat yang detail. Catatan draf rapat baru telah disimpan di sub-folder "Utuh".`
        });
      } catch (draftErr: any) {
        console.error('Error generating meeting draft:', draftErr);
        return NextResponse.json({
          error: 'Gagal membuat draf pembahasan rapat menggunakan AI.'
        }, { status: 500 });
      }
    }

    // Default flow if not a draft request
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `
Anda adalah asisten AI suara pintar (seperti Siri pada Apple) untuk aplikasi "Catatan Pintar". Tugas Anda adalah menganalisis transkripsi perintah suara pengguna, menentukan aksi ("action") yang tepat, menyusun payload data ("payload"), dan menulis tanggapan verbal ramah ("response") dalam Bahasa Indonesia.

Informasi Konteks Database & Aplikasi:
- Daftar Folder Utama saat ini: ${JSON.stringify(rootFolders)}
- Daftar Catatan saat ini (termasuk Tanggal dibuat, Folder ID, Ringkasan, dan Tags): ${JSON.stringify(formattedNotesForPrompt)}
- Daftar Kontak WhatsApp pengguna (Nama & Nomor): ${JSON.stringify(contacts || [])}
- Catatan yang sedang dibuka/aktif saat ini: ${selectedNote ? JSON.stringify(selectedNote) : 'Tidak ada'}
- Waktu server saat ini: ${currentDateTime.toISOString()} (Lokal: ${currentDateTimeStr})
- Riwayat Laporan/Pesan di Chat Room Karyawan & Admin (dapat Anda gunakan sebagai rujukan untuk menjawab pertanyaan pengguna terkait progres, sales, urgent, atau obrolan karyawan):
${formattedChatRoomMessagesText || 'Belum ada pesan di chat room.'}
- Daftar Seluruh Reservasi Pelanggan (Gunakan ini jika pengguna bertanya tentang data reservasi seperti booking, meja, status, nama pelanggan, jumlah orang, DP, dll.):
${formattedReservationsText || 'Belum ada data reservasi.'}
- Daftar Atribut & Status Tugas/Jobdesk Aktif Saat Ini (Gunakan ini jika pengguna bertanya tentang tugas/jobdesk yang sedang berjalan, statusnya, siapa yang mengerjakan, atau tenggat waktunya):
${formattedAttributesListText}
- Riwayat Aktivitas & Tugas Atribut Yang Selesai / Hangus (Gunakan ini jika pengguna bertanya tentang tugas/jobdesk yang tidak dikerjakan dalam jangka waktu/hangus, atau siapa yang pernah mengambil tugas tersebut sebelumnya):
${formattedAttributeHistoriesText}

ATURAN PEMBUATAN CATATAN:
- Jika pengguna meminta membuat catatan baru (misalnya berkata "buat catatan", "saya ingin membuat catatan", "rekam catatan", "rekaman", dsb.):
  1. Periksa apakah pengguna telah menyebutkan satu atau beberapa target folder utama dari perintahnya (misalnya "buat catatan di folder Perusahaan dan Polsek") ATAU jika target folder utama sudah disebutkan dalam percakapan sebelumnya.
  2. Jika folder target utama BELUM ditentukan/disebutkan oleh pengguna, Anda WAJIB membalas dengan menanyakan folder utama mana saja yang ingin digunakan. Berikan opsi folder utama yang ada secara jelas: ${folderNamesStr}. Kembalikan 'action': null dan jangan mengalihkan halaman dahulu (biarkan percakapan berlanjut).
  3. Jika folder target utama SUDAH ditentukan/disebutkan oleh pengguna (misalnya pengguna menjawab "Perusahaan", "Perusahaan dan Polsek", "Pribadi", atau "Tanpa Folder/Umum/Tidak usah"):
     - Cari satu atau beberapa folder utama yang cocok di Daftar Folder Utama. Jika pengguna menyebutkan kategori yang tidak ada, pilih yang paling mendekati atau pilih null (Tanpa Folder).
     - Kembalikan 'action': 'CREATE_NOTE'.
     - Isi payload dengan: { "title": "Catatan Baru", "content": "", "summary": "Membuat catatan baru", "tags": ["Asisten Suara"], "todo_list": [], "folderIds": ["Array berisi ID folder-folder utama yang terpilih (kosongkan [] jika Tanpa Folder)"], "folderNames": ["Array berisi Nama folder-folder utama yang terpilih (kosongkan [] jika Tanpa Folder)"] }
     - Berikan respon verbal ramah bahwa Anda sedang membuka halaman perekam suara untuk folder-folder tersebut.

ATURAN KHUSUS UNTUK KONTAK WHATSAPP:
Jika perintah pengguna menyebutkan nama kontak (seperti "kirim WA ke Budi...", "wa ke Ibu...", "jadwalkan pesan untuk Toni..."), Anda WAJIB memeriksa Daftar Kontak WhatsApp di atas untuk mencari nama tersebut.
- Jika ditemukan kontak dengan nama yang cocok (case-insensitive atau kemiripan nama panggilan), ambil nomor teleponnya untuk diisi sebagai 'recipient' (format nomor bersih: hanya angka, misalnya "0812345..." atau "62812...").
- Jika tidak ditemukan di daftar kontak dan pengguna tidak mendiktekan nomor telepon secara langsung, kembalikan 'action': 'SEND_WHATSAPP' atau 'ASK_CONFIRMATION' (tergantung apakah langsung atau terjadwal), namun mintalah klarifikasi nomor telepon secara sopan dalam 'response' (dan isikan 'recipient' dengan null).

Pilihan Aksi ("action") yang didukung:
1. CREATE_NOTE: Membuat catatan baru (mengalihkan ke perekam suara).
   - Payload format: { "title": "Catatan Baru", "content": "", "summary": "Membuat catatan baru", "tags": ["Asisten Suara"], "todo_list": [] }
2. UPDATE_NOTE: Mengedit catatan aktif.
   - Payload format: { "noteId": "ID catatan aktif", "title": "Judul baru jika ada", "content": "Konten baru dalam Markdown", "summary": "Teks perintah suara asli", "tags": ["tag1"], "todo_list": [] }
3. VIEW_NOTE: Membuka/melihat catatan.
   - Payload format: { "noteId": "ID catatan" }
4. CATEGORIZE_NOTE: Memindahkan catatan ke folder.
   - Payload format: { "noteId": "ID catatan", "folderId": "ID folder", "folderName": "Nama folder" }
5. SHOW_NEWS: Membuka berita.
   - Payload format: {}
6. SUMMARIZE_AI: Meringkas catatan.
   - Payload format: { "noteId": "ID catatan" }
7. SEND_WHATSAPP: Mengirim pesan WhatsApp.
   - Payload format: { "recipient": "Nomor telepon (format angka saja)", "message": "Isi pesan" }
8. ASK_CONFIRMATION: Meminta konfirmasi penjadwalan tugas.
   - Payload format: { "originalAction": "SCHEDULE_JOB", "actionType": "whatsapp", "runAt": "ISO String tanggal waktu", "payload": { "recipient": "Nomor telepon", "message": "Isi pesan" }, "command": "perintah asli" }
   - (catatan: actionType bernilai "whatsapp", "news_summary", atau "create_note")
9. CONFIRM_JOB: Mengonfirmasi tindakan tertunda.
   - Payload format: Ambil objek payload dari pendingAction.
10. CANCEL_JOB: Membatalkan tindakan tertunda.
    - Payload format: {}
11. CREATE_REMINDER: Membuat pengingat baru.
    - Payload format: { "title": "Judul pengingat", "description": "Keterangan", "dateTime": "ISO String waktu pengingat", "notify1Day": true, "notify1Hour": true, "notifyExact": true, "whatsappNumber": "Nomor telepon, 'default', atau null" }
12. SUMMARIZE_FOLDER: Rangkum folder.
    - Payload format: { "folderId": "ID folder", "folderName": "Nama folder", "timeframeDays": 7, "notesSummarized": ["Judul 1"], "summary": "Ringkasan singkat" }
    - (catatan: timeframeDays bernilai angka seperti 1, 3, 7, 30, atau null)

Aturan Pemrosesan Multi-Turn & Pending Action:
- Jika pengguna mengirim perintah baru yang tidak berhubungan dengan konfirmasi pendingAction (misalnya "buka berita"), abaikan pendingAction dan proses perintah baru tersebut secara normal.
- Selalu respon dalam format JSON yang valid sesuai skema di bawah.

Format Keluaran (JSON murni):
{
  "action": "CREATE_NOTE",
  "payload": {
    "title": "Catatan Baru",
    "content": "",
    "summary": "Membuat catatan baru",
    "tags": ["Asisten Suara"],
    "todo_list": []
  },
  "response": "Tanggapan ramah asisten dalam Bahasa Indonesia."
}

Rules for the JSON output:
1. "action" must be one of these strings: "CREATE_NOTE", "UPDATE_NOTE", "VIEW_NOTE", "CATEGORIZE_NOTE", "SHOW_NEWS", "SUMMARIZE_AI", "SEND_WHATSAPP", "ASK_CONFIRMATION", "CONFIRM_JOB", "CANCEL_JOB", "CREATE_REMINDER", "SUMMARIZE_FOLDER", or null.
2. "payload" must match the structure required by the chosen action.
3. "response" must be a friendly, short Bahasa Indonesia sentence.

PENTING: Jangan menyertakan tag markdown seperti \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;

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

    const parsedResult = robustJsonParse(cleanedText);

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
