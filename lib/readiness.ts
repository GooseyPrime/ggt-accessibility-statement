import { decideConformance } from "./conformance";
import { isoDate } from "./dates";
import { applyBuyerPlans } from "./report";
import type {
  AccessibilityReport,
  BuyerAnswers,
  PartId,
  PartResult,
  ReadinessResult,
  SiteFacts,
} from "./types";
import { PART_META } from "./types";

export type ScoreInput = {
  facts: SiteFacts;
  report: AccessibilityReport;
  answers?: BuyerAnswers;
  now?: Date;
  defaultStandard: string;
  standardChecked: string;
};

export function scoreReadiness(input: ScoreInput): ReadinessResult {
  const generatedOn = isoDate(input.now ?? new Date());
  const decision = decideConformance(input.report);
  const standard =
    input.answers?.standardConfirm?.trim() ||
    input.report.standard ||
    input.defaultStandard;

  const parts: PartResult[] = [
    partSite(input),
    partStandard(standard, input.standardChecked),
    partConformance(decision.status, decision.reason),
    partAssessment(input, generatedOn),
    partLimitations(input),
    partReporting(input),
    partContact(input),
    partDate(input, generatedOn),
    partAlternative(input),
  ];

  const filled = parts.filter((part) => part.filled);
  return {
    score: filled.length,
    total: 9,
    parts,
    missing: parts.filter((part) => !part.filled),
    conformance: decision.status,
    conformanceReason: decision.reason,
    standard,
    standardChecked: input.standardChecked,
    generatedOn,
  };
}

function part(
  id: PartId,
  filled: boolean,
  source: PartResult["source"],
  summary: string,
  stillNeeds?: string,
): PartResult {
  const meta = PART_META[id];
  return {
    id,
    number: meta.number,
    title: meta.title,
    filled,
    source,
    summary,
    stillNeeds: filled ? undefined : stillNeeds ?? meta.publishNeed,
  };
}

function partSite(input: ScoreInput): PartResult {
  const { facts, answers } = input;
  if (!facts.normalizedUrl) {
    return part("site", false, "missing", "No usable website address yet.");
  }
  const name = facts.siteName || facts.pageTitle;
  if (!name) {
    return part(
      "site",
      false,
      "missing",
      `Address resolved to ${facts.normalizedUrl}, but no site name was found.`,
      "Confirm the site name and whether the statement covers the whole site.",
    );
  }
  const scope = answers?.scope;
  const scopeNote =
    scope === "subset" && answers?.subsetDescription
      ? ` Covers a subset: ${answers.subsetDescription}.`
      : scope === "whole_site"
        ? " Covers the whole website."
        : " Scope treated as the whole website until you say otherwise.";
  return part(
    "site",
    true,
    "auto",
    `${name} at ${facts.normalizedUrl}.${scopeNote}`,
  );
}

function partStandard(standard: string, checked: string): PartResult {
  return part(
    "standard",
    Boolean(standard),
    "default",
    `${standard}. Default last checked ${checked}. Confirm this is the level you aim at.`,
  );
}

function partConformance(
  status: ReadinessResult["conformance"],
  reason: string,
): PartResult {
  return part("conformance", true, "report", reason);
}

function partAssessment(input: ScoreInput, generatedOn: string): PartResult {
  const method = input.answers?.assessmentMethod?.trim() || input.report.method;
  const date = input.answers?.assessmentDate?.trim() || input.report.assessedAt;
  if (method && date) {
    return part("assessment", true, input.report.method ? "report" : "buyer", `${method} on ${date}.`);
  }
  if (method) {
    return part(
      "assessment",
      false,
      "missing",
      `Method found (${method}), but no assessment date.`,
      "Add the date of the last assessment.",
    );
  }
  if (input.report.present && input.report.source !== "none") {
    return part(
      "assessment",
      false,
      "missing",
      "A report is linked but it does not name the method and date.",
      "Add how the site was assessed and the date of that assessment.",
    );
  }
  return part(
    "assessment",
    false,
    "missing",
    `No assessment method yet. Today is ${generatedOn}.`,
    "Add how the site was assessed and the date of that assessment.",
  );
}

function partLimitations(input: ScoreInput): PartResult {
  const barriers = applyBuyerPlans(input.report.barriers, input.answers?.limitationPlans);
  if (barriers.length > 0) {
    return part(
      "limitations",
      true,
      "report",
      `${barriers.length} known limitation${barriers.length === 1 ? "" : "s"} taken from the linked report.`,
    );
  }
  if (
    input.report.present &&
    (input.report.source === "json" || input.report.source === "url")
  ) {
    const decision = decideConformance(input.report);
    if (decision.status === "fully_conformant") {
      return part(
        "limitations",
        true,
        "report",
        "The linked report lists no barriers. The statement will say none were found in that assessment.",
      );
    }
  }
  return part(
    "limitations",
    false,
    "missing",
    "No measured barriers are on file. This tool will not invent them.",
    "Link or paste a real accessibility report, or leave this section blank until you have one.",
  );
}

function partReporting(input: ScoreInput): PartResult {
  const buyer = input.answers?.reportingPath?.trim();
  if (buyer) {
    return part("reporting", true, "buyer", buyer);
  }
  if (input.facts.feedbackUrl) {
    return part("reporting", true, "auto", `Report a problem via ${input.facts.feedbackUrl}.`);
  }
  if (input.facts.emails[0]) {
    return part("reporting", true, "auto", `Email ${input.facts.emails[0]}.`);
  }
  if (input.facts.contactUrl) {
    return part("reporting", true, "auto", `Use the contact page at ${input.facts.contactUrl}.`);
  }
  return part(
    "reporting",
    false,
    "missing",
    "No reporting path found on the site.",
    "Say how someone should report an accessibility problem.",
  );
}

function partContact(input: ScoreInput): PartResult {
  const buyer = input.answers?.contactDetails?.trim();
  if (buyer) {
    return part("contact", true, "buyer", buyer);
  }
  const bits = [
    input.facts.emails[0] ? `Email ${input.facts.emails[0]}` : "",
    input.facts.phones[0] ? `phone ${input.facts.phones[0]}` : "",
    input.facts.contactUrl ? `contact page ${input.facts.contactUrl}` : "",
  ].filter(Boolean);
  if (bits.length) {
    return part("contact", true, "auto", `${bits.join("; ")}.`);
  }
  return part(
    "contact",
    false,
    "missing",
    "No email, phone, or contact page was found.",
    "Add contact details someone can use.",
  );
}

function partDate(input: ScoreInput, generatedOn: string): PartResult {
  const reviewed = input.answers?.lastReviewed?.trim() || input.report.assessedAt || generatedOn;
  return part(
    "date",
    true,
    input.answers?.lastReviewed ? "buyer" : input.report.assessedAt ? "report" : "default",
    `Statement date ${generatedOn}. Last reviewed ${reviewed}.`,
  );
}

function partAlternative(input: ScoreInput): PartResult {
  const how = input.answers?.alternativeFormatHow?.trim();
  if (how) {
    return part("alternativeFormat", true, "buyer", how);
  }
  return part(
    "alternativeFormat",
    false,
    "missing",
    "No path yet for asking for content in another format.",
    "Say how someone can ask for content in another format.",
  );
}
