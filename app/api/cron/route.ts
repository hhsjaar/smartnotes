import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:developer@catatanpintar.local',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Helper to clean and format telephone numbers for Fonnte
function cleanTargetNumber(target: string) {
  let cleaned = target.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
}

// Fetch and parse top 5 news from Antara News RSS feed
async function fetchTopNewsHeadlines() {
  try {
    const res = await fetch('https://www.antaranews.com/rss/terkini.xml', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      next: { revalidate: 60 }
    });
    
    if (!res.ok) return [];

    const xmlText = await res.text();
    const items: { title: string; description: string }[] = [];
    const parts = xmlText.split('<item>');
    
    for (let i = 1; i < Math.min(parts.length, 6); i++) {
      const part = parts[i];
      const titleExtract = part.match(/<title>([\s\S]*?)<\/title>/i);
      const descExtract = part.match(/<description>([\s\S]*?)<\/description>/i);
      
      const title = titleExtract ? titleExtract[1].replace(/<!\[CDATA\[/gi, '').replace(/\]\]>/gi, '').trim() : '';
      let desc = descExtract ? descExtract[1].replace(/<!\[CDATA\[/gi, '').replace(/\]\]>/gi, '').trim() : '';
      desc = desc.replace(/<[^>]*>/g, '').trim(); // Strip HTML
      
      if (title) {
        items.push({ title, description: desc });
      }
    }
    return items;
  } catch (err) {
    console.error('Failed to fetch RSS for news summary job:', err);
    return [];
  }
}

// Query Gemini to summarize news headlines into a clean markdown note
async function generateAIBriefing(newsItems: { title: string; description: string }[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return 'GEMINI_API_KEY tidak dikonfigurasi.';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
  
  const newsListStr = newsItems.map((item, idx) => `Berita ${idx + 1}:\nJudul: ${item.title}\nDetail: ${item.description}`).join('\n\n');
  
  const prompt = `
Anda adalah editor berita senior. Tugas Anda adalah mengambil daftar berita utama berikut dan menyusunnya menjadi sebuah catatan "Rangkuman Berita Harian" (Daily News Briefing) yang sangat informatif, rapi, dan terstruktur menggunakan Markdown.

Daftar Berita Hari Ini:
${newsListStr}

Instruksi Pemformatan Catatan:
1. Buat judul catatan: "Rangkuman Berita AI: [Topik Utama]"
2. Tulis analisis singkat (1 paragraf) mengenai tren berita hari ini.
3. Sebutkan poin-poin penting berita tersebut secara rapi menggunakan daftar bullet points (-) dan cetak tebal (bold) kata kunci.
4. Akhiri dengan catatan penutup yang memotivasi.

Kembalikan jawaban HANYA dalam format JSON dengan skema berikut (jangan tambahkan pembungkus markdown seperti \`\`\`json):
{
  "title": "Judul Catatan",
  "content": "Isi catatan lengkap dengan format markdown terstruktur"
}
`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error('Gemini briefing generation failed.');
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content returned from Gemini.');
  
  let cleanedText = text.trim();
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
  return JSON.parse(cleanedText);
}

async function processReminders(now: Date) {
  const reminderResults = [];
  try {
    const reminders = await prisma.reminder.findMany({
      where: {
        dateTime: {
          gte: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        },
        OR: [
          { sent1Day: false },
          { sent1Hour: false },
          { sentExact: false }
        ]
      }
    });

    if (reminders.length === 0) return [];

    const subscriptions = await prisma.pushSubscription.findMany();

    for (const reminder of reminders) {
      const eventTime = new Date(reminder.dateTime).getTime();
      const nowTime = now.getTime();
      const diffMs = eventTime - nowTime;

      let sendNotify = false;
      let notifyBody = '';
      let updatedFields: any = {};

      if (reminder.notify1Day && diffMs <= 24 * 60 * 60 * 1000 && diffMs > 1 * 60 * 60 * 1000 && !reminder.sent1Day) {
        sendNotify = true;
        notifyBody = `Besok: ${reminder.title} (${new Date(reminder.dateTime).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })})`;
        updatedFields.sent1Day = true;
      }
      else if (reminder.notify1Hour && diffMs <= 1 * 60 * 60 * 1000 && diffMs > 0 && !reminder.sent1Hour) {
        sendNotify = true;
        notifyBody = `1 jam lagi: ${reminder.title}`;
        updatedFields.sent1Hour = true;
        updatedFields.sent1Day = true;
      }
      else if (reminder.notifyExact && diffMs <= 0 && diffMs >= -15 * 60 * 1000 && !reminder.sentExact) {
        sendNotify = true;
        notifyBody = `Sekarang: ${reminder.title}`;
        updatedFields.sentExact = true;
        updatedFields.sent1Day = true;
        updatedFields.sent1Hour = true;
      }
      else if (diffMs < -15 * 60 * 1000) {
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            sent1Day: true,
            sent1Hour: true,
            sentExact: true
          }
        });
        continue;
      }

      if (sendNotify) {
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: updatedFields
        });

        // Send WhatsApp notification if whatsappNumber is set
        if (reminder.whatsappNumber) {
          try {
            const token = process.env.FONNTE_API_TOKEN;
            if (token) {
              const cleanedTarget = cleanTargetNumber(reminder.whatsappNumber);
              const waMessage = `*Alarm / Pengingat AI ⏰*\n\n${notifyBody}\n\n${reminder.description ? `_${reminder.description}_` : ''}`.trim();
              
              const waRes = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: {
                  'Authorization': token,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  target: cleanedTarget,
                  message: waMessage,
                  countryCode: '62',
                }),
              });

              const waData = await waRes.json();
              if (!waRes.ok || !waData.status) {
                console.error('Failed to send WhatsApp reminder:', waData.reason || 'Unknown error');
              } else {
                console.log('WhatsApp reminder sent successfully to:', cleanedTarget);
              }
            } else {
              console.error('FONNTE_API_TOKEN is not configured for cron reminders.');
            }
          } catch (waErr: any) {
            console.error('Error sending WhatsApp reminder in cron:', waErr.message);
          }
        }

        let successCount = 0;
        let failCount = 0;

        const pushPayload = JSON.stringify({
          title: 'Alarm / Pengingat AI ⏰',
          body: notifyBody,
          url: '/'
        });

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys as any
              },
              pushPayload
            );
            successCount++;
          } catch (err: any) {
            console.error('Failed sending webpush notification:', err.message);
            failCount++;
            if (err.statusCode === 410 || err.statusCode === 404) {
              await prisma.pushSubscription.delete({
                where: { id: sub.id }
              }).catch(console.error);
            }
          }
        }

        reminderResults.push({
          id: reminder.id,
          title: reminder.title,
          type: notifyBody.split(':')[0],
          sentTo: successCount,
          failedTo: failCount
        });
      }
    }
  } catch (err: any) {
    console.error('Error processing reminders in cron:', err);
  }
  return reminderResults;
}

export async function GET(request: Request) {
  try {
    const now = new Date();

    // Process Reminders first
    const reminderResults = await processReminders(now);
    
    // Find all pending jobs that should be executed
    const pendingJobs = await prisma.scheduledJob.findMany({
      where: {
        status: 'pending',
        runAt: {
          lte: now
        }
      }
    });

    const executionResults = [];

    for (const job of pendingJobs) {
      console.log(`Executing Job ID ${job.id} - Type: ${job.actionType}`);
      try {
        const payload: any = job.payload;
        
        if (job.actionType === 'whatsapp') {
          const token = process.env.FONNTE_API_TOKEN;
          if (!token) throw new Error('FONNTE_API_TOKEN tidak diset di server.');

          const cleanedTarget = cleanTargetNumber(payload.recipient);
          const waRes = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
              'Authorization': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              target: cleanedTarget,
              message: payload.message,
              countryCode: '62',
            }),
          });

          const waData = await waRes.json();
          if (!waRes.ok || !waData.status) {
            throw new Error(waData.reason || 'Gagal mengirim Fonnte WA.');
          }
          
        } else if (job.actionType === 'news_summary') {
          // Fetch top news
          const news = await fetchTopNewsHeadlines();
          if (news.length === 0) throw new Error('Gagal memuat berita terkini.');
          
          // Summarize news
          const briefing = await generateAIBriefing(news);
          
          // Create note in database
          await prisma.note.create({
            data: {
              title: briefing.title || 'Rangkuman Berita Harian',
              content: briefing.content || 'Isi rangkuman berita.',
              summary: 'Dibuat otomatis oleh Asisten Suara Terjadwal.',
              tags: ['Berita', 'Terjadwal', 'AI']
            }
          });

        } else if (job.actionType === 'create_note') {
          await prisma.note.create({
            data: {
              title: payload.title || 'Catatan Terjadwal',
              content: payload.content || 'Konten otomatis.',
              summary: 'Dibuat otomatis oleh Asisten Suara Terjadwal.',
              tags: ['Terjadwal', 'AI']
            }
          });
        } else {
          throw new Error(`Tipe aksi tidak dikenal: ${job.actionType}`);
        }

        // Mark as completed
        await prisma.scheduledJob.update({
          where: { id: job.id },
          data: { status: 'completed' }
        });

        executionResults.push({ id: job.id, status: 'success' });
      } catch (err: any) {
        console.error(`Error executing job ${job.id}:`, err);
        
        // Mark as failed
        await prisma.scheduledJob.update({
          where: { id: job.id },
          data: { status: 'failed' }
        });

        executionResults.push({ id: job.id, status: 'failed', error: err.message });
      }
    }

    return NextResponse.json({
      message: `Cron selesai diproses.`,
      reminders: reminderResults,
      results: executionResults,
      jobs: {
        executed: pendingJobs.length,
        results: executionResults
      }
    });
  } catch (error: any) {
    console.error('API Cron Job Runner Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
