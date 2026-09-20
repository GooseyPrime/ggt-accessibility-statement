import { inspectSite } from "@/lib/inspect-site";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { url?: unknown; reportText?: unknown };
  try {
    body = (await request.json()) as { url?: unknown; reportText?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Send a JSON body with a website address." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : "";
  const reportText = typeof body.reportText === "string" ? body.reportText : "";
  if (!url.trim()) {
    return NextResponse.json({ ok: false, message: "Enter a website address." }, { status: 400 });
  }

  const inspected = await inspectSite({ url, reportText });
  return NextResponse.json({
    ok: true,
    facts: inspected.facts,
    report: inspected.report,
  });
}
