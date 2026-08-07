function formatForWhatsApp(text) {
  if (!text) return '';

  let formatted = text;

  // 1. Convert Headers (# Header, ## Header, etc.) to WhatsApp bold (*Header*)
  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // 2. Convert Bold Markdown (**text** or __text__) to WhatsApp bold (*text*)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');
  formatted = formatted.replace(/__(.*?)__/g, '*$1*');

  // 3. Convert Strikethrough (~~text~~) to WhatsApp strikethrough (~text~)
  formatted = formatted.replace(/~~(.*?)~~/g, '~$1~');

  // 4. Convert Bullet points (•, *, +) at line start to WhatsApp bullet format (- )
  // Preserve indentation if present
  formatted = formatted.replace(/^(\s*)[•*+]\s+/gm, '$1- ');

  // 5. If bullet line is `- **text**`, line 2 already converted `**text**` -> `*text*`, so it's `- *text*`

  // 6. Clean up extra empty lines (3+ into 2)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
}

const sample2 = `
# Laporan Kegiatan

1. Evaluasi Pertama
   • **Sub poin 1:** Detail sub poin
   • **Sub poin 2:** Detail sub poin 2

2. Evaluasi Kedua
- **Kondisi:** Normal
`;

console.log("=== SAMPLE 2 CONVERTED ===");
console.log(formatForWhatsApp(sample2));
