import { resolveReport } from "@/lib/inspect-site";
import { normalizeAppReturnUrl, startSale } from "@/lib/payments";
import { hasUsableReport, parseReportInput } from "@/lib/report";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { url?: unknown; reportText?: unknown; returnUrl?: unknown };
  try {
    body = (await request.json()) as { url?: unknown; reportText?: unknown; returnUrl?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Send a JSON body." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : "";
  const reportText = typeof body.reportText === "string" ? body.reportText : "";
  const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl : "";
  if (!url.trim()) {
    return NextResponse.json({ ok: false, message: "Enter a website address." }, { status: 400 });
  }
  if (!returnUrl.trim()) {
    return NextResponse.json({ ok: false, message: "Missing return URL." }, { status: 400 });
  }

  const normalizedReturnUrl = normalizeAppReturnUrl(returnUrl, request.url);
  if (!normalizedReturnUrl) {
    return NextResponse.json(
      { ok: false, message: "Return URL must stay on this app's origin." },
      { status: 400 },
    );
  }

  const resolvedReport = await resolveReport(parseReportInput(reportText));

  const result = await startSale({
    url,
    withReport: hasUsableReport(resolvedReport),
    returnUrl: normalizedReturnUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    url: result.checkoutUrl,
    sessionId: result.sessionId,
  });
}
