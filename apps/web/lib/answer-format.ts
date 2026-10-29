export type AnswerFragment = { type: "text" | "link" | "strong"; text: string; url?: string };

/** Render a tiny safe subset of Markdown without injecting raw HTML. */
export function tokenizeAssistantText(content: string): AnswerFragment[] {
  const cleaned = content.replace(/^#{1,5}\s+/gm, "").replace(/^[-*]\s+/gm, "• ");
  const result: AnswerFragment[] = [];
  const re = /\[([^\]\n]{1,180})\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]{1,300})\*\*/g;
  let cursor = 0;
  for (const m of cleaned.matchAll(re)) {
    const index = m.index ?? 0;
    if (index > cursor) result.push({ type: "text", text: cleaned.slice(cursor, index) });
    if (m[1] && m[2]) {
      try {
        const url = new URL(m[2]);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Bad scheme");
        result.push({ type: "link", text: m[1], url: url.href });
      } catch {
        result.push({ type: "text", text: m[0] });
      }
    } else if (m[3]) {
      result.push({ type: "strong", text: m[3] });
    }
    cursor = index + m[0].length;
  }
  if (cursor < cleaned.length) result.push({ type: "text", text: cleaned.slice(cursor) });
  return result;
}
