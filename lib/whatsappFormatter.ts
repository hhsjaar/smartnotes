/**
 * Utility function to convert Markdown text into WhatsApp-compatible text format.
 * - Converts bold **text** or __text__ to *text*
 * - Converts headings (# Heading) to bold *Heading*
 * - Converts bullet points (•, *, +) to - (WhatsApp bullet format)
 * - Converts strikethrough ~~text~~ to ~text~
 */
export function formatForWhatsApp(text: string): string {
  if (!text) return '';

  let formatted = text;

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
