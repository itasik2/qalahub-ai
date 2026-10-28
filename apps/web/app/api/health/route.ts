import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "qalahub-ai-web", cityPilot: "Астана" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
