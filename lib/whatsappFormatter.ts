/**
 * Utility function to convert Markdown text into WhatsApp-compatible text format.
 * - Converts bold **text** or __text__ to *text*
 * - Converts headings (# Heading) to bold *Heading*
 * - Converts bullet points (•, *, +) to - (WhatsApp bullet format)
 * - Converts strikethrough ~~text~~ to ~text~
 * - Converts Markdown tables (not supported by WhatsApp) into readable "*Label:* value" lines
 */

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const splitCells = (line: string) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSeparatorRow = (line: string) =>
  isTableRow(line) && splitCells(line).every((c) => /^:?-{1,}:?$/.test(c));

/** Ubah satu blok tabel (header + baris) menjadi teks yang enak dibaca di WhatsApp. */
function tableToWhatsApp(header: string[], rows: string[][]): string {
  const clean = (v: string) => v.replace(/\*\*(.*?)\*\*/g, '$1').trim();
  const head = header.map(clean);

  // Tabel 2 kolom (cth: Keterangan | Isi): satu baris per pasangan
  if (head.length === 2) {
    return rows
      .filter((r) => clean(r[1] || '') !== '')
      .map((r) => `*${clean(r[0] || '')}:* ${clean(r[1] || '')}`)
      .join('\n');
  }

  // Tabel lebih lebar (cth: No | Penanya | Pertanyaan | ...): satu blok per baris
  const hasNumberColumn = /^(no|nomor|#)\.?$/i.test(head[0] || '');
  return rows
    .map((r, idx) => {
      const prefix = hasNumberColumn ? `${clean(r[0] || '') || idx + 1}.` : '-';
      const parts: string[] = [];
      for (let i = hasNumberColumn ? 1 : 0; i < head.length; i++) {
        const value = clean(r[i] || '');
        if (value && value !== '-') parts.push(`*${head[i]}:* ${value}`);
      }
      if (parts.length === 0) return '';
      return `${prefix} ${parts[0]}` + parts.slice(1).map((l) => `\n   ${l}`).join('');
    })
    .filter(Boolean)
    .join('\n');
}

function convertTables(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = splitCells(lines[i]);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && !isSeparatorRow(lines[j])) {
        rows.push(splitCells(lines[j]));
        j++;
      }
      out.push(tableToWhatsApp(header, rows));
      i = j;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join('\n');
}

export function formatForWhatsApp(text: string): string {
  if (!text) return '';

  // 0. Tabel Markdown tidak tampil di WhatsApp: ubah jadi baris teks lebih dulu
  let formatted = convertTables(text);

  // 1. Convert Headers (# Header, ## Header, etc.) to WhatsApp bold (*Header*)
  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // 2. Convert Bold Markdown (**text** or __text__) to WhatsApp bold (*text*)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');
  formatted = formatted.replace(/__(.*?)__/g, '*$1*');

  // 3. Convert Strikethrough (~~text~~) to WhatsApp strikethrough (~text~)
  formatted = formatted.replace(/~~(.*?)~~/g, '~$1~');

  // 4. Convert Bullet points (•, *, +) at start of line to WhatsApp bullet format (- )
  formatted = formatted.replace(/^(\s*)[•*+]\s+/gm, '$1- ');

  // 5. Clean up 3+ consecutive newlines to 2 newlines
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
}
