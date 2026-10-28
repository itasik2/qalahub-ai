export type PublicSource = { title: string; url: string };
export type InlineCitation = {
  startIndex: number;
  endIndex: number;
  url: string;
  title: string;
};
export type AgentAnswer = {
  answer: string;
  sources: PublicSource[];
  citations: InlineCitation[];
};

export function parseAgentAnswer(payload: unknown): AgentAnswer {
  if (!payload || typeof payload !== "object") throw new Error("Invalid AI response");
  const data = payload as Record<string, unknown>;
  if (!Array.isArray(data.output)) throw new Error("AI response has no output");

  const parts: string[] = [];
  const sources = new Map<string, PublicSource>();
  const citations: InlineCitation[] = [];
  let offset = 0;

  for (const item of data.output) {
    if (!item || typeof item !== "object") continue;
    const output = item as Record<string, unknown>;
    if (output.type !== "message" || !Array.isArray(output.content)) continue;

    for (const content of output.content) {
      if (!content || typeof content !== "object") continue;
      const segment = content as Record<string, unknown>;
      if (segment.type !== "output_text" || typeof segment.text !== "string") continue;
      if (parts.length) offset += 2; // Separator used in parts.join("\n\n").
      parts.push(segment.text);

      for (const candidate of Array.isArray(segment.annotations) ? segment.annotations : []) {
        if (!candidate || typeof candidate !== "object") continue;
        const a = candidate as Record<string, unknown>;
        if (a.type !== "url_citation") continue;
        const citation = a.url_citation && typeof a.url_citation === "object"
          ? a.url_citation as Record<string, unknown>
          : a;
        if (typeof citation.url !== "string") continue;
        try {
          const parsed = new URL(citation.url);
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
          const title = typeof citation.title === "string" && citation.title.trim()
            ? citation.title.trim().slice(0, 140)
            : parsed.hostname;

          sources.set(parsed.href, { url: parsed.href, title });
          const start = citation.start_index;
          const end = citation.end_index;
          if (typeof start === "number" && typeof end === "number"
              && Number.isInteger(start) && Number.isInteger(end)
              && start >= 0 && end > start && end <= segment.text.length) {
            citations.push({
              startIndex: offset + start,
              endIndex: offset + end,
              url: parsed.href,
              title,
            });
          }
        } catch {
          // Ignore invalid or unsupported citation URLs.
        }
      }
      offset += segment.text.length;
    }
  }

  const fullAnswer = parts.join("\n\n");
  const startTrim = fullAnswer.length - fullAnswer.trimStart().length;
  const answer = fullAnswer.trim();
  if (!answer) throw new Error("Empty AI answer");

  return {
    answer,
    sources: [...sources.values()].slice(0, 10),
    citations: citations
      .map((mark) => ({
        ...mark,
        startIndex: mark.startIndex - startTrim,
        endIndex: mark.endIndex - startTrim,
      }))
      .filter((mark) => mark.startIndex >= 0 && mark.endIndex <= answer.length)
      .sort((a, b) => a.startIndex - b.startIndex)
      .slice(0, 30),
  };
}
