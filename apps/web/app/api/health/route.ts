import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "qalahub-ai-web", cityPilot: "Астана", aiConfigured: Boolean(process.env.OPENAI_API_KEY && process.env.QALAHUB_ACCESS_CODE) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
