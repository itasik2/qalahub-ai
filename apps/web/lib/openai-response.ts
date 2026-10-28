export type PublicSource = { title: string; url: string };
export type AgentAnswer = { answer: string; sources: PublicSource[] };

export function parseAgentAnswer(payload: unknown): AgentAnswer {
  if (!payload || typeof payload !== "object") throw new Error("Invalid AI response");
  const data = payload as Record<string, unknown>;
  if (!Array.isArray(data.output)) throw new Error("AI response has no output");

  const parts: string[] = [];
  const sources = new Map<string, PublicSource>();

  for (const item of data.output) {
    if (!item || typeof item !== "object") continue;
    const output = item as Record<string, unknown>;
    if (output.type !== "message" || !Array.isArray(output.content)) continue;

    for (const content of output.content) {
      if (!content || typeof content !== "object") continue;
      const segment = content as Record<string, unknown>;
      if (segment.type !== "output_text" || typeof segment.text !== "string") continue;
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
          sources.set(parsed.href, {
            url: parsed.href,
            title: typeof citation.title === "string" && citation.title.trim()
              ? citation.title.trim().slice(0, 140)
              : parsed.hostname,
          });
        } catch {
          // Ignore malformed citations.
        }
      }
    }
  }

  const answer = parts.join("\n\n").trim();
  if (!answer) throw new Error("Empty AI answer");
  return { answer, sources: [...sources.values()].slice(0, 10) };
}
