import { verifySale } from "@/lib/payments";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  const result = await verifySale(sessionId);
  return NextResponse.json(result, { status: result.paid || result.ok ? 200 : 400 });
}

export async function POST(request: Request) {
  let sessionId = "";
  try {
    const body = (await request.json()) as { session_id?: unknown; sessionId?: unknown };
    sessionId = typeof body.session_id === "string" ? body.session_id : typeof body.sessionId === "string" ? body.sessionId : "";
  } catch {
    sessionId = "";
  }
  const result = await verifySale(sessionId);
  return NextResponse.json(result, { status: result.paid || result.ok ? 200 : 400 });
}
