import { shopOrigin, TOOL_ID } from "./config";

export type SaleRequest = {
  url: string;
  withReport: boolean;
  returnUrl: string;
};

export type SaleResult =
  | { ok: true; checkoutUrl: string; sessionId?: string }
  | { ok: false; message: string };

export type VerifyResult = {
  ok: boolean;
  paid: boolean;
  kind?: string;
  message?: string;
  sessionId?: string;
};

const LOCAL_SESSION = "local";

export function shopSaleUrl(origin: string): string {
  return `${origin}/api/sale`;
}

export function shopCheckoutUrl(origin: string): string {
  return `${origin}/api/checkout`;
}

export function shopVerifyUrl(origin: string, sessionId: string): string {
  const target = new URL(`${origin}/api/verify`);
  target.searchParams.set("session_id", sessionId);
  return target.toString();
}

export function salePayload(input: SaleRequest) {
  return {
    url: input.url,
    toolId: TOOL_ID,
    product: TOOL_ID,
    withReport: input.withReport,
    success_url: input.returnUrl,
    returnUrl: input.returnUrl,
  };
}

export async function startSale(input: SaleRequest): Promise<SaleResult> {
  const origin = shopOrigin();
  if (!origin) {
    if (process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK === "true") {
      const next = new URL(input.returnUrl);
      next.searchParams.set("session_id", LOCAL_SESSION);
      return { ok: true, checkoutUrl: next.toString(), sessionId: LOCAL_SESSION };
    }
    return {
      ok: false,
      message: "Shop payments are not configured. Set NEXT_PUBLIC_SHOP_ORIGIN from the shop desk.",
    };
  }

  const body = JSON.stringify(salePayload(input));
  const first = await postJson(shopSaleUrl(origin), body);
  if (first.ok) return first;
  if (first.retryable) {
    const second = await postJson(shopCheckoutUrl(origin), body);
    if (second.ok) return second;
    return { ok: false, message: second.message };
  }
  return { ok: false, message: first.message };
}

export async function verifySale(sessionId: string): Promise<VerifyResult> {
  if (!sessionId) {
    return { ok: false, paid: false, kind: "invalid_request", message: "Missing checkout session id." };
  }

  const origin = shopOrigin();
  if (!origin) {
    if (process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK === "true" && sessionId === LOCAL_SESSION) {
      return { ok: true, paid: true, sessionId, kind: "local_unlock" };
    }
    return {
      ok: false,
      paid: false,
      kind: "unconfigured",
      message: "Shop verification is not configured.",
    };
  }

  const getUrl = shopVerifyUrl(origin, sessionId);
  const getRes = await fetch(getUrl, { method: "GET", headers: { Accept: "application/json" } });
  const getBody = await readJson(getRes);
  if (isVerifyShape(getBody)) {
    return normalizeVerify(getBody, sessionId);
  }

  const postRes = await fetch(`${origin}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ session_id: sessionId, sessionId }),
  });
  const postBody = await readJson(postRes);
  if (isVerifyShape(postBody)) {
    return normalizeVerify(postBody, sessionId);
  }

  return {
    ok: false,
    paid: false,
    kind: "invalid_response",
    message: "The shop did not confirm this sale.",
  };
}

async function postJson(
  url: string,
  body: string,
): Promise<SaleResult & { retryable?: boolean }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
    if (res.status === 404 || res.status === 405) {
      return { ok: false, message: "Sale route not found.", retryable: true };
    }
    const data = await readJson(res);
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const checkoutUrl =
        asString(record.url) ?? asString(record.checkoutUrl) ?? asString(record.checkout_url);
      if (res.ok && record.ok === true && checkoutUrl) {
        return {
          ok: true,
          checkoutUrl,
          sessionId: asString(record.sessionId) ?? asString(record.session_id),
        };
      }
      return {
        ok: false,
        message: asString(record.message) ?? "The shop could not start checkout.",
      };
    }
    return { ok: false, message: "The shop could not start checkout." };
  } catch {
    return { ok: false, message: "Could not reach the shop payment desk.", retryable: true };
  }
}

function isVerifyShape(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && "paid" in (value as object));
}

function normalizeVerify(data: Record<string, unknown>, sessionId: string): VerifyResult {
  const paid = data.paid === true;
  return {
    ok: data.ok === true || paid,
    paid,
    kind: asString(data.kind),
    message: asString(data.message),
    sessionId: asString(data.sessionId) ?? asString(data.session_id) ?? sessionId,
  };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
