import type { AgentAnswer } from "./openai-response";

/**
 * Search API can include web_search_call.action.sources.
 * They are sources consulted by search, NOT proof that a venue is located in
 * the selected city. We use them for source-tracing metrics only.
 */
export function collectSearchSourceUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;
  if (!Array.isArray(data.output)) return [];
  const urls = new Set<string>();

  for (const item of data.output) {
    if (!item || typeof item !== "object") continue;
    const output = item as Record<string, unknown>;
    if (output.type !== "web_search_call") continue;
    const action = output.action && typeof output.action === "object"
      ? output.action as Record<string, unknown> : null;
    if (!Array.isArray(action?.sources)) continue;
    for (const source of action.sources) {
      if (!source || typeof source !== "object") continue;
      const entry = source as Record<string, unknown>;
      if (typeof entry.url !== "string") continue;
      try {
        const url = new URL(entry.url);
        if (url.protocol === "https:" || url.protocol === "http:") urls.add(url.href);
      } catch { /* ignore malformed URLs */ }
    }
  }
  return [...urls];
}

function canonicalUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(fbclid|gclid|yclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
  } catch {
    return null;
  }
}

export function countSourceMatches(answer: AgentAnswer, consultedUrls: string[]): number {
  const seen = new Set(consultedUrls.map(canonicalUrl).filter((v): v is string => Boolean(v)));
  return answer.sources.reduce((count, source) =>
    count + (seen.has(canonicalUrl(source.url) ?? "") ? 1 : 0), 0);
}
