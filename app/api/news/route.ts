import { NextResponse } from 'next/server';

interface CacheEntry {
  data: any;
  timestamp: number;
}

// Global in-memory cache for aggregated news categories
const newsCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 5 * 60 * 1000; // Cache TTL of 5 minutes

interface FeedConfig {
  url: string;
  source: string;
}

const CATEGORY_FEEDS: Record<string, FeedConfig[]> = {
  'Semua': [
    { url: 'https://www.antaranews.com/rss/terpopuler.xml', source: 'Antara News (Populer)' },
    { url: 'https://www.cnnindonesia.com/nasional/rss', source: 'CNN Indonesia' },
    { url: 'https://news.detik.com/rss', source: 'Detikcom' },
    { url: 'https://www.cnbcindonesia.com/rss', source: 'CNBC Indonesia' },
    { url: 'https://rss.tempo.co/nasional', source: 'Tempo.co' }
  ],
  'Teknologi': [
    { url: 'https://www.cnnindonesia.com/teknologi/rss', source: 'CNN Indonesia' },
    { url: 'https://inet.detik.com/rss', source: 'Detikcom' },
    { url: 'https://www.cnbcindonesia.com/tech/rss', source: 'CNBC Indonesia' },
    { url: 'https://www.antaranews.com/rss/tekno.xml', source: 'Antara News' }
  ],
  'Bisnis': [
    { url: 'https://www.cnnindonesia.com/ekonomi/rss', source: 'CNN Indonesia' },
    { url: 'https://finance.detik.com/rss', source: 'Detikcom' },
    { url: 'https://www.cnbcindonesia.com/market/rss', source: 'CNBC Indonesia' },
    { url: 'https://www.antaranews.com/rss/ekonomi.xml', source: 'Antara News' }
  ],
  'Politik': [
    { url: 'https://www.cnnindonesia.com/nasional/rss', source: 'CNN Indonesia' },
    { url: 'https://www.antaranews.com/rss/politik.xml', source: 'Antara News' },
    { url: 'https://news.detik.com/rss', source: 'Detikcom' },
    { url: 'https://rss.tempo.co/nasional', source: 'Tempo.co' }
  ],
  'Kesehatan': [
    { url: 'https://www.cnnindonesia.com/gaya-hidup/rss', source: 'CNN Indonesia' },
    { url: 'https://www.cnbcindonesia.com/lifestyle/rss', source: 'CNBC Indonesia' },
    { url: 'https://www.antaranews.com/rss/lifestyle.xml', source: 'Antara News' }
  ],
  'Hiburan': [
    { url: 'https://www.cnnindonesia.com/hiburan/rss', source: 'CNN Indonesia' },
    { url: 'https://hot.detik.com/rss', source: 'Detikcom' },
    { url: 'https://www.antaranews.com/rss/hiburan.xml', source: 'Antara News' }
  ],
  'Olahraga': [
    { url: 'https://www.cnnindonesia.com/olahraga/rss', source: 'CNN Indonesia' },
    { url: 'https://sport.detik.com/rss', source: 'Detikcom' },
    { url: 'https://www.antaranews.com/rss/olahraga.xml', source: 'Antara News' }
  ],
};

const cleanCDATA = (str: string) => {
  return str.replace(/<!\[CDATA\[/gi, '').replace(/\]\]>/gi, '').trim();
};

const decodeEntities = (html: string) => {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ');
};

async function fetchAndParseFeed(feed: FeedConfig, category: string): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout per feed to avoid locking
    
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 60 } // Cache fetch for 1 minute
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      return [];
    }

    const xmlText = await res.text();
    const items: any[] = [];
    const parts = xmlText.split('<item>');
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      const titleExtract = part.match(/<title>([\s\S]*?)<\/title>/i);
      const linkExtract = part.match(/<link>([\s\S]*?)<\/link>/i);
      const descExtract = part.match(/<description>([\s\S]*?)<\/description>/i);
      const dateExtract = part.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      
      let title = titleExtract ? cleanCDATA(titleExtract[1]) : '';
      let url = linkExtract ? cleanCDATA(linkExtract[1]) : '';
      let summary = descExtract ? cleanCDATA(descExtract[1]) : '';
      let pubDateStr = dateExtract ? cleanCDATA(dateExtract[1]) : '';
      
      // Clean HTML tags from summary
      summary = summary.replace(/<[^>]*>/g, '').trim();
      
      title = decodeEntities(title);
      summary = decodeEntities(summary);
      
      let dateObj = new Date();
      if (pubDateStr) {
        const d = new Date(pubDateStr);
        if (!isNaN(d.getTime())) {
          dateObj = d;
        }
      }
      
      if (title && url) {
        items.push({
          title: title.trim(),
          source: feed.source,
          url: url.trim(),
          summary: summary.length > 220 ? summary.substring(0, 220).trim() + '...' : summary.trim(),
          category: category,
          pubDate: dateObj.getTime(), // store timestamp for sorting
        });
      }
      
      if (items.length >= 40) break; // limit to 40 items per feed to combine
    }
    return items;
  } catch (error) {
    console.warn(`Failed to fetch feed ${feed.url}:`, error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'Semua';
    const refresh = searchParams.get('refresh') === 'true';
    const type = searchParams.get('type') || 'terkini'; // 'terkini' | 'hari_ini'

    const cacheKey = `${category}_${type}`;
    const now = Date.now();

    // Serve cached aggregated data if available and fresh, unless a refresh is forced
    if (!refresh && newsCache[cacheKey] && (now - newsCache[cacheKey].timestamp < CACHE_TTL)) {
      console.log(`[Cache Hit] Serving cached aggregated news for category: ${category}, type: ${type}`);
      return NextResponse.json(newsCache[cacheKey].data);
    }

    const feeds = CATEGORY_FEEDS[category] || CATEGORY_FEEDS['Semua'];
    
    // Fetch all feeds in parallel
    const feedResults = await Promise.allSettled(
      feeds.map(feed => fetchAndParseFeed(feed, category))
    );
    
    let allItems: any[] = [];
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        allItems = allItems.concat(result.value);
      }
    }
    
    // Sort all merged items by publication date descending
    allItems.sort((a, b) => b.pubDate - a.pubDate);
    
    let selectedItems = allItems;

    if (type === 'hari_ini' && allItems.length > 0) {
      // Get the top 100 candidates to evaluate for virality/hype
      const candidateItems = allItems.slice(0, 100);
      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey) {
        try {
          const simplifiedList = candidateItems.map((item, idx) => ({
            id: idx,
            title: item.title,
            summary: item.summary,
            source: item.source
          }));

          const prompt = `Anda adalah editor berita senior di Indonesia. Tugas Anda adalah menyusun daftar berita paling hangat diperbincangkan (viral/trending) dan memiliki urgensi strategis nasional bagi masyarakat Indonesia dalam 24 jam terakhir.
          
Aturan pemilihan berita:
1. PRIORITASKAN Isu Strategis Nasional: Kebijakan pemerintah pusat, perkembangan ekonomi makro (rupiah, inflasi, anggaran), politik nasional, mega-proyek nasional, hubungan diplomatik, isu keamanan nasional, atau tren industri teknologi berskala besar.
2. PRIORITASKAN Berita Populer Nasional: Kejadian besar yang banyak diketahui dan dibicarakan oleh masyarakat Indonesia dari media massa utama.
3. HINDARI Berita Trivial/Skala Kecil: Filter dan buang berita sepele skala lokal (seperti jadwal SIM Keliling di kota tertentu, kecelakaan lalu lintas minor daerah, berita kriminalitas lokal kecil, lowongan kerja instansi daerah kecil, event kelurahan, atau cuaca harian daerah).
4. HINDARI Gosip/Selebriti Minor: Jangan pilih berita gosip artis kecuali peristiwa tersebut sangat viral dan menjadi perbincangan publik nasional secara luas.

Dari daftar berita berikut, pilihlah tepat 30 berita terbaik yang memenuhi kriteria di atas:
${JSON.stringify(simplifiedList, null, 2)}

Kembalikan hasil pilihan Anda HANYA berupa array JSON yang berisi ID/indeks dari berita yang terpilih (berjumlah tepat 30 berita), sebagai contoh: [0, 3, 5, 12, 19, ...].
PENTING: Jangan sertakan teks penjelasan lainnya atau tag markdown seperti \`\`\`json. Kembalikan HANYA array JSON murni yang valid.`;

          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
          
          const payload = {
            contents: [{
              role: 'user',
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          };

          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const data = await res.json();
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (resultText) {
              const selectedIds = JSON.parse(resultText.trim());
              if (Array.isArray(selectedIds)) {
                selectedItems = selectedIds
                  .filter(id => id >= 0 && id < candidateItems.length)
                  .map(id => ({ ...candidateItems[id], isViral: true }));
              }
            }
          }
        } catch (geminiError) {
          console.warn('Failed to currate viral news with Gemini:', geminiError);
        }
      }

      // Fallback if Gemini failed or key not present: just take top 30 recent articles
      if (selectedItems.length === allItems.length) {
        selectedItems = candidateItems.slice(0, 30).map(item => ({ ...item, isViral: true }));
      }
    } else {
      // Keep top 120 for normal news
      selectedItems = allItems.slice(0, 120);
    }
    
    // Format the timestamp to a human-readable relative/absolute date string
    const finalItems = selectedItems.map(item => {
      const d = new Date(item.pubDate);
      const diffMs = Date.now() - item.pubDate;
      const diffMin = Math.floor(diffMs / (60 * 1000));
      const diffHr = Math.floor(diffMs / (60 * 60 * 1000));
      
      let time = 'Baru saja';
      if (diffMin < 60) {
        time = diffMin <= 0 ? 'Baru saja' : `${diffMin} menit yang lalu`;
      } else if (diffHr < 24) {
        time = `${diffHr} jam yang lalu`;
      } else {
        time = d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      
      return {
        title: item.title,
        source: item.source,
        url: item.url,
        summary: item.summary,
        category: item.category,
        time: time,
        isViral: item.isViral || false
      };
    });

    // Cache the aggregated news list
    newsCache[cacheKey] = {
      data: finalItems,
      timestamp: now,
    };

    return NextResponse.json(finalItems);
  } catch (error: any) {
    console.error('API RSS News Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
