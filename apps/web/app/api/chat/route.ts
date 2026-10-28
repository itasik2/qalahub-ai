import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ChatInputError, parseChatPayload } from "../../../lib/chat";
import { parseAgentAnswer } from "../../../lib/openai-response";
import { buildAgentInstructions, createCitySearchTool, getResponseUsage } from "../../../lib/agent-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  let payload;
  try {
    if (Number(request.headers.get("content-length") || "0") > 26000) {
      return NextResponse.json({ error: "Слишком большой запрос." }, { status: 413 });
    }
    payload = parseChatPayload(await request.json());
  } catch (error) {
    return NextResponse.json({
      error: error instanceof ChatInputError ? error.message : "Некорректный JSON.",
    }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY;
  const pilotCode = process.env.QALAHUB_ACCESS_CODE;
  if (!key || !pilotCode) {
    return NextResponse.json({ error: "ИИ пока не настроен администратором." }, { status: 503 });
  }
  if (!sameSecret(payload.accessCode, pilotCode)) {
    return NextResponse.json({ error: "Неверный код доступа к пилоту." }, { status: 403 });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: buildAgentInstructions(payload.city, new Date()),
        input: payload.messages,
        tools: [createCitySearchTool(payload.city)],
        tool_choice: "required",
        max_output_tokens: 1100,
        store: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });

    if (!upstream.ok) {
      console.error("QalaHub AI provider status", upstream.status);
      return NextResponse.json({ error: "Сервис поиска временно недоступен. Попробуйте позднее." }, { status: 502 });
    }

    const upstreamPayload: unknown = await upstream.json();
    const result = parseAgentAnswer(upstreamPayload);
    const usage = getResponseUsage(upstreamPayload);
    // Metrics only; never log user questions, access codes or source URLs.
    if (usage) console.info("qalahub.chat.usage", {
      ...usage,
      sourceCount: result.sources.length,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("QalaHub AI request failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Не удалось получить ответ. Попробуйте ещё раз." }, { status: 502 });
  }
}
