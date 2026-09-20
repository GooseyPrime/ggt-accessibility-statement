import { parseLooseDate } from "./dates";
import { parseConformanceClaim } from "./conformance";
import { normalizeUrl } from "./normalize-url";
import type { AccessibilityReport, Barrier } from "./types";

const EMPTY: AccessibilityReport = {
  present: false,
  source: "none",
  barriers: [],
};

export function emptyReport(): AccessibilityReport {
  return { ...EMPTY, barriers: [] };
}

export function parseReportInput(raw: string | undefined | null): AccessibilityReport {
  const text = raw?.trim() ?? "";
  if (!text) return emptyReport();

  const json = tryParseJson(text);
  if (json) return fromUnknown(json, "json");

  if (looksLikeUrl(text) && !text.includes("{")) {
    const url = normalizeUrl(text);
    if (url.href) {
      return {
        present: true,
        source: "url",
        sourceUrl: url.href,
        barriers: [],
      };
    }
  }

  if (looksLikeToken(text)) {
    return {
      present: true,
      source: "token",
      rawToken: text.slice(0, 200),
      barriers: [],
    };
  }

  return {
    present: true,
    source: "unreadable",
    barriers: [],
  };
}

export function fromUnknown(
  value: unknown,
  source: AccessibilityReport["source"] = "json",
): AccessibilityReport {
  if (!value || typeof value !== "object") {
    return { present: true, source: "unreadable", barriers: [] };
  }

  const data = value as Record<string, unknown>;
  const nested = firstObject(data.report, data.accessibility, data.result, data.assessment);
  const root = nested ?? data;

  const claimed =
    parseConformanceClaim(root.conformance) ??
    parseConformanceClaim(root.conformanceStatus) ??
    parseConformanceClaim(root.status) ??
    parseConformanceClaim(root.verdict);

  const passed = asBoolean(root.passed);
  const failed = asBoolean(root.failed) ?? asBoolean(root.fail);
  const score = asNumber(root.score ?? root.scoreOutOf100);
  const barriers = collectBarriers(root);

  return {
    present: true,
    source,
    standard: asString(root.standard ?? root.target ?? root.wcag),
    method: asString(root.method ?? root.howAssessed ?? root.assessmentMethod),
    assessedAt: parseLooseDate(root.assessedAt ?? root.date ?? root.assessedOn ?? root.checkedAt),
    claimedConformance: claimed,
    passed,
    failed: failed ?? (typeof score === "number" && score < 50 ? true : undefined),
    score,
    barriers,
    sourceUrl: asString(root.url ?? root.sourceUrl),
    rawToken: asString(root.token ?? root.reportToken),
  };
}

function collectBarriers(root: Record<string, unknown>): Barrier[] {
  const lists = [
    root.barriers,
    root.findings,
    root.issues,
    root.violations,
    root.limitations,
    root.problems,
  ];

  const out: Barrier[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const [index, item] of list.entries()) {
      const barrier = asBarrier(item, index);
      if (barrier) out.push(barrier);
    }
    if (out.length) break;
  }
  return dedupeBarriers(out);
}

function asBarrier(item: unknown, index: number): Barrier | null {
  if (typeof item === "string") {
    const summary = item.trim();
    if (!summary) return null;
    return {
      id: `barrier-${index + 1}`,
      summary,
      reason: "",
      alternative: "",
      plan: "",
    };
  }
  if (!item || typeof item !== "object") return null;
  const data = item as Record<string, unknown>;
  const summary = asString(
    data.summary ?? data.title ?? data.description ?? data.message ?? data.plain ?? data.text,
  );
  if (!summary) return null;
  return {
    id: asString(data.id ?? data.key) ?? `barrier-${index + 1}`,
    summary,
    reason: asString(data.reason ?? data.why ?? data.cause) ?? "",
    alternative: asString(data.alternative ?? data.workaround ?? data.instead) ?? "",
    criterion: asString(data.criterion ?? data.wcag ?? data.successCriterion),
    plan: asString(data.plan ?? data.beingFixedBy) ?? "",
  };
}

function dedupeBarriers(barriers: Barrier[]): Barrier[] {
  const seen = new Set<string>();
  const out: Barrier[] = [];
  for (const barrier of barriers) {
    const key = dedupeKey(barrier);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(barrier);
  }
  return out;
}

function dedupeKey(barrier: Barrier): string {
  const id = barrier.id.trim().toLowerCase();
  if (id && !/^barrier-\d+$/.test(id)) {
    return `id:${id}`;
  }
  return `summary:${barrier.summary.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  return /[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed.split(/\s+/)[0] ?? "");
}

function looksLikeToken(text: string): boolean {
  if (text.length > 180 || /\s/.test(text)) return false;
  return /^[a-z0-9][a-z0-9._:-]{7,}$/i.test(text);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "yes") return true;
    if (v === "false" || v === "no") return false;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function firstObject(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

export function applyBuyerPlans(
  barriers: Barrier[],
  plans: Record<string, string> | undefined,
): Barrier[] {
  if (!plans) return barriers.map((b) => ({ ...b }));
  return barriers.map((barrier) => ({
    ...barrier,
    plan: plans[barrier.id] ?? barrier.plan,
  }));
}
