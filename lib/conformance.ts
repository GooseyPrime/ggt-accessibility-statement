import type { AccessibilityReport, ConformanceStatus } from "./types";

const RANK: Record<ConformanceStatus, number> = {
  fully_conformant: 3,
  partially_conformant: 2,
  not_conformant: 1,
  not_assessed: 0,
};

const ALIASES: Record<string, ConformanceStatus> = {
  fully_conformant: "fully_conformant",
  "fully conformant": "fully_conformant",
  full: "fully_conformant",
  conformant: "fully_conformant",
  compliant: "fully_conformant",
  pass: "fully_conformant",
  passed: "fully_conformant",
  partially_conformant: "partially_conformant",
  "partially conformant": "partially_conformant",
  partly_conformant: "partially_conformant",
  "partly conformant": "partially_conformant",
  partial: "partially_conformant",
  partly: "partially_conformant",
  not_conformant: "not_conformant",
  "not conformant": "not_conformant",
  non_conformant: "not_conformant",
  "non-conformant": "not_conformant",
  fail: "not_conformant",
  failed: "not_conformant",
  not_assessed: "not_assessed",
  "not assessed": "not_assessed",
  unknown: "not_assessed",
  none: "not_assessed",
};

export function parseConformanceClaim(value: unknown): ConformanceStatus | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return ALIASES[key] ?? ALIASES[key.replace(/ /g, "_")];
}

export function minStatus(a: ConformanceStatus, b: ConformanceStatus): ConformanceStatus {
  return RANK[a] <= RANK[b] ? a : b;
}

export type ConformanceDecision = {
  status: ConformanceStatus;
  reason: string;
  evidence: string[];
};

/**
 * Honest status only. A report can lower a claim; nothing may raise it.
 * Fully conformant requires an explicit pass and no recorded barriers.
 */
export function decideConformance(report: AccessibilityReport): ConformanceDecision {
  const evidence: string[] = [];

  if (!report.present || report.source === "none") {
    return {
      status: "not_assessed",
      reason: "No accessibility report was provided, so this site is not assessed.",
      evidence,
    };
  }

  if (report.source === "unreadable" || report.source === "token") {
    return {
      status: "not_assessed",
      reason:
        "A report token or link was given but could not be read as an assessment, so this site is not assessed.",
      evidence,
    };
  }

  let status: ConformanceStatus = report.claimedConformance ?? "not_assessed";
  if (report.claimedConformance) {
    evidence.push(`Report claim: ${report.claimedConformance}.`);
  }

  const failed = report.failed === true || report.passed === false;
  if (failed) {
    evidence.push("Report marked the assessment as failed.");
    status = minStatus(status, "not_conformant");
    if (status === "not_assessed") status = "not_conformant";
  }

  if (report.barriers.length > 0) {
    evidence.push(`${report.barriers.length} measured barrier(s) in the report.`);
    if (status === "fully_conformant" || status === "not_assessed") {
      status = "partially_conformant";
    }
  }

  if (status === "fully_conformant") {
    const allowed =
      report.claimedConformance === "fully_conformant" &&
      report.barriers.length === 0 &&
      report.failed !== true &&
      report.passed !== false;
    if (!allowed) {
      status = report.barriers.length > 0 ? "partially_conformant" : "not_assessed";
      evidence.push("Fully conformant was refused: the report does not support that claim.");
    }
  }

  if (status === "not_assessed" && (failed || report.barriers.length > 0)) {
    status = failed && report.barriers.length === 0 ? "not_conformant" : "partially_conformant";
  }

  const reason = reasonFor(status, report);
  return { status, reason, evidence };
}

function reasonFor(status: ConformanceStatus, report: AccessibilityReport): string {
  if (status === "fully_conformant") {
    return "The linked report supports full conformance and lists no barriers.";
  }
  if (status === "not_conformant") {
    return "The linked report marks the site as not conformant, or the assessment failed.";
  }
  if (status === "partially_conformant") {
    return report.barriers.length
      ? "The linked report lists barriers, so the honest status is partially conformant."
      : "The linked report does not support full conformance.";
  }
  return "There is not enough assessment evidence to claim conformance.";
}

export function conformanceLabel(status: ConformanceStatus): string {
  switch (status) {
    case "fully_conformant":
      return "fully conformant";
    case "partially_conformant":
      return "partially conformant";
    case "not_conformant":
      return "not conformant";
    case "not_assessed":
      return "not assessed";
  }
}

export function conformanceSentence(status: ConformanceStatus, standard: string): string {
  const label = conformanceLabel(status);
  if (status === "not_assessed") {
    return `This website has not been assessed against ${standard}. No full-conformance claim is made.`;
  }
  if (status === "partially_conformant") {
    return `This website is ${label} with ${standard}. Partially conformant means some parts of the site do not fully meet the standard.`;
  }
  if (status === "not_conformant") {
    return `This website is ${label} with ${standard}.`;
  }
  return `This website is ${label} with ${standard}.`;
}
