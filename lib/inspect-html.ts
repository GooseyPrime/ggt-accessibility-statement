import { resolveHref } from "./normalize-url";
import type { SiteFacts } from "./types";

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const OG_SITE_RE = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["'][^>]*>/i;
const OG_SITE_RE_REV = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["'][^>]*>/i;
const H1_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;
const MAILTO_RE = /mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;
const TEL_RE = /tel:(\+?[\d().\s-]{7,20})/gi;
const HREF_RE = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

const CONTACT_HREF = /(contact|get-in-touch|support|feedback|reach-us)/i;
const CONTACT_TEXT = /contact(\s+us)?|get\s+in\s+touch|email\s+us|support/i;
const A11Y_HREF = /(accessibility|a11y|accessibilite)/i;
const A11Y_TEXT = /accessibility(\s+statement)?/i;
const FEEDBACK_HREF = /(feedback|report[-_]?a[-_]?problem|accessibility[-_]?feedback)/i;

export function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSiteFacts(html: string, pageUrl: string, inputUrl: string): SiteFacts {
  const title = decode(first(html, TITLE_RE));
  const ogSite = decode(first(html, OG_SITE_RE) ?? first(html, OG_SITE_RE_REV));
  const h1 = decode(first(html, H1_RE));

  const emails = unique(matchAll(html, MAILTO_RE).map((m) => m[1]?.toLowerCase() ?? "").filter(Boolean));
  const phones = unique(matchAll(html, TEL_RE).map((m) => normalizePhone(m[1] ?? "")).filter(Boolean));

  let contactUrl: string | null = null;
  let feedbackUrl: string | null = null;
  let accessibilityPageUrl: string | null = null;

  for (const match of matchAll(html, HREF_RE)) {
    const href = match[1] ?? "";
    const text = stripTags(match[2] ?? "");
    const resolved = resolveHref(pageUrl, href);
    if (!resolved) continue;

    if (
      !contactUrl &&
      (CONTACT_HREF.test(href) || CONTACT_TEXT.test(text)) &&
      hasAllowedScheme(resolved, ["http:", "https:", "mailto:", "tel:"])
    ) {
      contactUrl = resolved;
    }
    if (
      !feedbackUrl &&
      (FEEDBACK_HREF.test(href) || /report a problem/i.test(text)) &&
      hasAllowedScheme(resolved, ["http:", "https:", "mailto:"])
    ) {
      feedbackUrl = resolved;
    }
    if (
      !accessibilityPageUrl &&
      (A11Y_HREF.test(href) || A11Y_TEXT.test(text)) &&
      hasAllowedScheme(resolved, ["http:", "https:"])
    ) {
      accessibilityPageUrl = resolved;
    }
  }

  if (!feedbackUrl && emails[0]) {
    feedbackUrl = `mailto:${emails[0]}`;
  }

  const siteName = ogSite || tidyName(h1) || tidyName(title);

  return {
    inputUrl,
    normalizedUrl: pageUrl,
    fetchOk: true,
    siteName: siteName || null,
    pageTitle: title || null,
    contactUrl,
    feedbackUrl,
    emails,
    phones,
    accessibilityPageUrl,
  };
}

function first(html: string, re: RegExp): string | undefined {
  const match = html.match(re);
  return match?.[1]?.trim();
}

function matchAll(html: string, re: RegExp): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = copy.exec(html))) {
    out.push(match);
    if (!copy.global) break;
  }
  return out;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function decode(value: string | undefined): string {
  if (!value) return "";
  return stripTags(value);
}

function tidyName(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\s*[|\-–—].*$/, "").trim();
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasAllowedScheme(value: string, allowed: string[]): boolean {
  try {
    return allowed.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
