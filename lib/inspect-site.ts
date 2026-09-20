import { extractSiteFacts } from "./inspect-html";
import { isBlockedHost, normalizeUrl } from "./normalize-url";
import { emptyReport, fromUnknown, parseReportInput } from "./report";
import type { AccessibilityReport, SiteFacts } from "./types";

const FETCH_MS = 8000;
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
    const parsed = new URL(href);
    if (isBlockedHost(parsed.hostname)) {
      return { error: "That address cannot be checked from this tool." };
    }
    const res = await fetch(href, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    const finalUrl = res.url || href;
    const finalHost = new URL(finalUrl).hostname;
    if (isBlockedHost(finalHost)) {
      return { error: "That address cannot be checked from this tool." };
    }
    if (!res.ok) {
      return { error: `The site responded with ${res.status}. Try again, or confirm the address.` };
    }
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain/i.test(type)) {
      return { error: "That address did not return a web page." };
    }
    const html = await res.text();
    return { html, finalUrl };
  } catch {
    return { error: "Could not reach that website. Check the address and try again." };
  }
}

async function hydrateReport(report: AccessibilityReport): Promise<AccessibilityReport> {
  if (report.source !== "url" || !report.sourceUrl) return report;
  try {
    const parsed = new URL(report.sourceUrl);
    if (isBlockedHost(parsed.hostname)) {
      return { ...report, source: "unreadable" };
    }
    const res = await fetch(report.sourceUrl, {
      method: "GET",
      headers: { Accept: "application/json,text/plain", "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (!res.ok) return { ...report, source: "unreadable" };
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return fromUnknown(json, "url");
    } catch {
      return { ...report, source: "unreadable" };
    }
  } catch {
    return { ...report, source: "unreadable" };
  }
}
