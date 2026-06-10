import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { title, url, summary, source } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Judul berita tidak boleh kosong' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY tidak dikonfigurasi di server.' }, { status: 500 });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Anda adalah asisten AI pembaca berita profesional. Tugas Anda adalah memberikan ringkasan eksekutif yang cerdas, mendalam, dan cepat dibaca dari berita berikut:

Judul Berita: "${title}"
Sumber: "${source}"
Tautan Asli: "${url}"
Ringkasan Awal: "${summary}"

Lakukan pencarian Google Search (grounding) untuk mendapatkan detail berita secara lengkap, lalu kembalikan ringkasan terstruktur dalam Bahasa Indonesia yang berisi:
1. Konteks Utama (1-2 kalimat).
2. 3 Poin Penting (Bullet Points) yang menjelaskan fakta utama atau kronologi peristiwa.
3. Implikasi atau Dampak dari berita tersebut (1 kalimat).

Kembalikan hasil ringkasan HANYA dalam format JSON dengan skema berikut:
{
  "context": "Konteks Utama berita ditulis di sini dalam 1-2 kalimat",
  "points": [
    "Poin penting 1 ditulis lengkap di sini",
    "Poin penting 2 ditulis lengkap di sini",
    "Poin penting 3 ditulis lengkap di sini"
  ],
  "impact": "Implikasi atau Dampak utama berita ditulis di sini"
}

PENTING: Jangan gunakan tanda titik-titik (elipsis seperti ...) di luar tanda kutip atau sebagai placeholder. Jangan sertakan tag markdown \`\`\`json atau teks tambahan lainnya. Kembalikan HANYA string JSON murni yang valid.`;

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
      tools: [
        {
          googleSearch: {}
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini Summarize Error:', res.status, errText);
      return NextResponse.json({ error: `Gagal mengenerate ringkasan: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return NextResponse.json({ error: 'Tidak ada respons dari model AI.' }, { status: 500 });
    }

    let summarizedJson;
    try {
      let cleanedText = resultText.trim();
      
      // Extract the JSON block if wrapped in conversational text
      const start = cleanedText.indexOf('{');
      const end = cleanedText.lastIndexOf('}');
      if (start !== -1 && end !== -1 && start < end) {
        cleanedText = cleanedText.substring(start, end + 1);
      }
      
      summarizedJson = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn('Failed to parse Gemini response as JSON. Attempting regex fallback:', parseError);
      
      // Attempt to extract context, points, and impact using regex as a fallback
      const contextMatch = resultText.match(/"context"\s*:\s*"([^"]+)"/i);
      const impactMatch = resultText.match(/"impact"\s*:\s*"([^"]+)"/i);
      
      // Extract points as strings inside quotes inside brackets
      const pointsBlockMatch = resultText.match(/"points"\s*:\s*\[([\s\S]*?)\]/i);
      const points: string[] = [];
      if (pointsBlockMatch) {
        const pointMatches = pointsBlockMatch[1].match(/"([^"]+)"/g);
        if (pointMatches) {
          pointMatches.forEach((p: string) => {
            points.push(p.replace(/"/g, '').trim());
          });
        }
      }
      
      summarizedJson = {
        context: contextMatch ? contextMatch[1] : `Ringkasan untuk berita: ${title}`,
        points: points.length > 0 ? points : [summary || 'Poin penting berita ini.'],
        impact: impactMatch ? impactMatch[1] : 'Dampak dari peristiwa ini sedang dipantau.'
      };
    }
    return NextResponse.json(summarizedJson);
  } catch (error: any) {
    console.error('API Summarize Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
