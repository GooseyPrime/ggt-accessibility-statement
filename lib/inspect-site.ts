import { extractSiteFacts } from "./inspect-html";
import { isBlockedHost, normalizeUrl } from "./normalize-url";
import { emptyReport, fromUnknown, parseReportInput } from "./report";
import type { AccessibilityReport, SiteFacts } from "./types";

const FETCH_MS = 8000;
const MAX_FETCH_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;
const UA = "GoldenGooseTools-AccessibilityStatement/0.1";

export type InspectResult = {
  facts: SiteFacts;
  report: AccessibilityReport;
};

export async function inspectSite(input: {
  url: string;
  reportText?: string;
  now?: Date;
}): Promise<InspectResult> {
  const normalized = normalizeUrl(input.url);
  const report = parseReportInput(input.reportText);

  if (!normalized.href || !normalized.host) {
    return {
      facts: {
        inputUrl: input.url,
        normalizedUrl: null,
        normalizeNote: normalized.note,
        fetchOk: false,
        fetchError: normalized.error ?? "Enter a website address.",
        siteName: null,
        pageTitle: null,
        contactUrl: null,
        feedbackUrl: null,
        emails: [],
        phones: [],
        accessibilityPageUrl: null,
      },
      report,
    };
  }

  const fetched = await fetchPage(normalized.href);
  const facts = fetched.html
    ? extractSiteFacts(fetched.html, fetched.finalUrl ?? normalized.href, input.url)
    : emptyFacts(input.url, normalized.href, fetched.error);
  facts.normalizeNote = normalized.note;
  facts.fetchedAt = (input.now ?? new Date()).toISOString();

  const hydrated = await hydrateReport(report);
  return { facts, report: hydrated };
}

function emptyFacts(inputUrl: string, normalizedUrl: string, error?: string): SiteFacts {
  return {
    inputUrl,
    normalizedUrl,
    fetchOk: false,
    fetchError: error,
    siteName: null,
    pageTitle: null,
    contactUrl: null,
    feedbackUrl: null,
    emails: [],
    phones: [],
    accessibilityPageUrl: null,
  };
}

async function fetchPage(href: string): Promise<{ html?: string; finalUrl?: string; error?: string }> {
  try {
    const fetched = await fetchTextWithChecks({
      href,
      accept: "text/html,application/xhtml+xml",
      allowContentType: (type) => !type || /html|xml|text\/plain/i.test(type),
    });
    if (!fetched.text) {
      return { error: fetched.error };
    }
    return { html: fetched.text, finalUrl: fetched.finalUrl };
  } catch {
    return { error: "Could not reach that website. Check the address and try again." };
  }
}

async function hydrateReport(report: AccessibilityReport): Promise<AccessibilityReport> {
  if (report.source !== "url" || !report.sourceUrl) return report;
  try {
    const fetched = await fetchTextWithChecks({
      href: report.sourceUrl,
      accept: "application/json,text/plain",
    });
    if (!fetched.text) return { ...report, source: "unreadable" };
    try {
      const json = JSON.parse(fetched.text);
      return fromUnknown(json, "url");
    } catch {
      return { ...report, source: "unreadable" };
    }
  } catch {
    return { ...report, source: "unreadable" };
  }
}

async function fetchTextWithChecks(input: {
  href: string;
  accept: string;
  allowContentType?: (type: string) => boolean;
}): Promise<{ text?: string; finalUrl?: string; error?: string }> {
  const signal = AbortSignal.timeout(FETCH_MS);
  let current = input.href;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const parsed = new URL(current);
    if (!isSafeFetchTarget(parsed)) {
      return { error: "That address cannot be checked from this tool." };
    }

    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: input.accept, "User-Agent": UA },
      signal,
    });

    if (isRedirect(res.status)) {
      const location = res.headers.get("location");
      if (!location) {
        return { error: "Could not reach that website. Check the address and try again." };
      }
      const next = new URL(location, current);
      if (!isSafeFetchTarget(next)) {
        return { error: "That address cannot be checked from this tool." };
      }
      current = next.toString();
      continue;
    }

    if (!res.ok) {
      return { error: `The site responded with ${res.status}. Try again, or confirm the address.` };
    }

    const type = res.headers.get("content-type") ?? "";
    if (input.allowContentType && !input.allowContentType(type)) {
      return { error: "That address did not return a web page." };
    }

    const text = await readLimitedText(res, MAX_FETCH_BYTES);
    if (text == null) {
      return { error: "That address returned too much data for this tool." };
    }
    return { text, finalUrl: current };
  }

  return { error: "That address redirected too many times." };
}

function isSafeFetchTarget(url: URL): boolean {
  return (url.protocol === "http:" || url.protocol === "https:") && !isBlockedHost(url.hostname);
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

async function readLimitedText(res: Response, maxBytes: number): Promise<string | null> {
  const length = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(length) && length > maxBytes) {
    return null;
  }

  if (!res.body) {
    const text = await res.text();
    return Buffer.byteLength(text) > maxBytes ? null : text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}
