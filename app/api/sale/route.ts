import { resolveReport } from "@/lib/inspect-site";
import { shopOrigin } from "@/lib/config";
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

  // Buyers reach this app through the shop, which proxies /tools/accessibility-statement
  // here. The browser's address is then on the shop's origin while request.url is this
  // deployment's own, so the shop origin has to be accepted alongside it.
  const shop = shopOrigin();
  const normalizedReturnUrl = normalizeAppReturnUrl(returnUrl, request.url, shop ? [shop] : []);
  if (!normalizedReturnUrl) {
    return NextResponse.json(
      {
        ok: false,
        message: "Return URL must use this app's origin and an allowed path, or the configured shop origin's tool path.",
      },
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
