// Mesin suara browser (terutama Chrome Android) sering mengirim ulang kalimat yang sama dengan
// revisi kecil ("dicek lagi" -> "di cek lagi") sehingga teks menumpuk berulang. Fungsi ini membuang
// pengulangan semacam itu dan mempertahankan versi TERAKHIR (biasanya paling lengkap/akurat).

const MIN_WORDS = 5; // pengulangan di bawah ini dianggap wajar (cth: "ya ya ya")
const LOOKBACK_WORDS = 300; // sejauh apa mencari versi sebelumnya
const MAX_WINDOW_WORDS = 120; // panjang maksimum satu pengulangan yang dibandingkan
const PREFIX_WORDS = 3; // kandidat harus diawali kata-kata yang mirip (pemangkas cepat)
const MIN_SIMILARITY = 0.85;
const MAX_TAIL_WORDS = 3; // kata tambahan setelah versi lama yang boleh dipertahankan

const normWord = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const normJoin = (ws: string[]) => ws.map(normWord).join('');

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  if (Math.abs(a.length - b.length) / max > 1 - MIN_SIMILARITY) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[b.length] / max;
}

export function dedupeRepeatedSpeech(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS * 2) return text.trim();

  const out: string[] = [];
  let i = 0;

  while (i < words.length) {
    const anchor = normWord(words[i]);
    let replaced = false;

    if (anchor) {
      const from = Math.max(0, out.length - LOOKBACK_WORDS);
      // Cari dari kemunculan terdekat ke terjauh; ambil pengulangan pertama yang cocok.
      for (let p = out.length - 1; p >= from && !replaced; p--) {
        if (normWord(out[p]) !== anchor) continue;
        const oldLen = out.length - p;
        if (oldLen < MIN_WORDS) continue;
        if (oldLen > MAX_WINDOW_WORDS) break; // makin ke belakang makin panjang, tidak perlu lanjut

        // Pemangkas cepat: beberapa kata pertama harus mirip sebelum membandingkan seluruh jendela
        const prefixOld = normJoin(out.slice(p, p + PREFIX_WORDS));
        const prefixNew = normJoin(words.slice(i, i + PREFIX_WORDS));
        if (levenshteinRatio(prefixOld, prefixNew) < MIN_SIMILARITY) continue;

        // Versi lama bisa diikuti beberapa kata tambahan yang bukan bagian dari pengulangan
        // (cth: "...dicek lagi penyempurnaan"); kata ekor itu dipertahankan, bagian ulangnya diganti.
        let best: { oldLen: number; tail: number; len: number; score: number } | null = null;
        for (let tail = 0; tail <= MAX_TAIL_WORDS; tail++) {
          const cmpOldLen = oldLen - tail;
          if (cmpOldLen < MIN_WORDS) break;
          const oldNorm = normJoin(out.slice(p, p + cmpOldLen));
          for (let delta = -2; delta <= 3; delta++) {
            const newLen = cmpOldLen + delta;
            if (newLen < MIN_WORDS || i + newLen > words.length) continue;
            const score = levenshteinRatio(oldNorm, normJoin(words.slice(i, i + newLen)));
            if (score >= MIN_SIMILARITY && (!best || score > best.score)) {
              best = { oldLen: cmpOldLen, tail, len: newLen, score };
            }
          }
        }

        if (best) {
          const keptTail = out.slice(p + best.oldLen); // kata tambahan setelah versi lama
          out.length = p;
          for (let k = 0; k < best.len; k++) out.push(words[i + k]);
          out.push(...keptTail);
          i += best.len;
          replaced = true;
        }
      }
    }

    if (!replaced) {
      out.push(words[i]);
      i++;
    }
  }
  return out.join(' ');
}
