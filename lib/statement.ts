import { conformanceSentence } from "./conformance";
import { applyBuyerPlans } from "./report";
import type {
  AccessibilityReport,
  BuyerAnswers,
  ReadinessResult,
  SiteFacts,
  StatementModel,
} from "./types";

export const DISCLAIMER =
  "This is general information, not legal advice. It describes what was known when the statement was prepared.";

export function buildStatement(input: {
  facts: SiteFacts;
  report: AccessibilityReport;
  answers?: BuyerAnswers;
  readiness: ReadinessResult;
}): StatementModel {
  const { facts, report, answers, readiness } = input;
  const siteUrl = facts.normalizedUrl ?? facts.inputUrl;
  const siteLabel = facts.siteName || facts.pageTitle || siteUrl;
  const barriers = applyBuyerPlans(report.barriers, answers?.limitationPlans);

  const scopeLine =
    answers?.scope === "subset"
      ? `This statement covers part of ${siteLabel} (${siteUrl}): ${answers.subsetDescription?.trim() || "[describe the pages this covers]"}.`
      : `This statement covers the website ${siteLabel} at ${siteUrl}.`;

  const method = answers?.assessmentMethod?.trim() || report.method;
  const assessedAt = answers?.assessmentDate?.trim() || report.assessedAt;
  const assessmentLine = method
    ? `This website was assessed by ${method}${assessedAt ? ` on ${assessedAt}` : ""}.`
    : "[Add how this website was assessed, and the date of that assessment.]";

  const reporting =
    answers?.reportingPath?.trim() ||
    (facts.feedbackUrl ? `Report a problem at ${facts.feedbackUrl}.` : "") ||
    (facts.emails[0] ? `Email ${facts.emails[0]} to report a problem.` : "") ||
    "[Say how someone should report an accessibility problem.]";

  const contactBits = [
    answers?.contactDetails?.trim() ?? "",
    !answers?.contactDetails && facts.emails[0] ? facts.emails[0] : "",
    !answers?.contactDetails && facts.phones[0] ? facts.phones[0] : "",
    !answers?.contactDetails && facts.contactUrl ? facts.contactUrl : "",
  ].filter(Boolean);
  const contactLine = contactBits.length
    ? contactBits.join(" · ")
    : "[Add contact details.]";

  const lastReviewed =
    answers?.lastReviewed?.trim() || report.assessedAt || readiness.generatedOn;

  const alternativeFormatLine =
    answers?.alternativeFormatHow?.trim() ||
    "[Say how someone can ask for this content in another format.]";

  return {
    siteLabel,
    siteUrl,
    scopeLine,
    standard: readiness.standard,
    conformance: readiness.conformance,
    conformanceSentence: conformanceSentence(readiness.conformance, readiness.standard),
    assessmentLine,
    barriers,
    reportingLine: reporting,
    contactLine,
    dateLine: `This statement was prepared on ${readiness.generatedOn}.`,
    lastReviewed: `Last reviewed: ${lastReviewed}.`,
    alternativeFormatLine,
    disclaimer: DISCLAIMER,
  };
}

export function renderPlainText(model: StatementModel): string {
  const lines = [
    `Accessibility statement for ${model.siteLabel}`,
    "",
    model.scopeLine,
    "",
    "Standard aimed at",
    model.standard,
    "",
    "Conformance status",
    model.conformanceSentence,
    "",
    "How this website was assessed",
    model.assessmentLine,
    "",
    "Known limitations",
    ...renderLimitationText(model),
    "",
    "Reporting a problem",
    model.reportingLine,
    "",
    "Contact",
    model.contactLine,
    "",
    "Content in another format",
    model.alternativeFormatLine,
    "",
    model.dateLine,
    model.lastReviewed,
    "",
    model.disclaimer,
  ];
  return lines.join("\n");
}

export function renderHtml(model: StatementModel): string {
  const limitations = model.barriers.length
    ? model.barriers
        .map((barrier) => {
          const reason = barrier.reason
            ? `<p>Reason: ${escapeHtml(barrier.reason)}</p>`
            : `<p>Reason: [add why this barrier exists]</p>`;
          const alternative = barrier.alternative
            ? `<p>What you can do instead: ${escapeHtml(barrier.alternative)}</p>`
            : `<p>What you can do instead: [describe an alternative]</p>`;
          const plan = barrier.plan
            ? `<p>Being fixed by: ${escapeHtml(barrier.plan)}</p>`
            : `<p>Being fixed by: [add a date or owner]</p>`;
          const criterion = barrier.criterion
            ? `<p>Related criterion: ${escapeHtml(barrier.criterion)}</p>`
            : "";
          return `<h3>${escapeHtml(barrier.summary)}</h3>\n${reason}\n${alternative}\n${plan}${criterion ? `\n${criterion}` : ""}`;
        })
        .join("\n")
    : "<p>No measured barriers were supplied with this statement. None have been invented.</p>";

  return [
    `<h1>Accessibility statement for ${escapeHtml(model.siteLabel)}</h1>`,
    `<h2>About this website</h2>`,
    `<p>${escapeHtml(model.scopeLine)}</p>`,
    `<h2>Standard aimed at</h2>`,
    `<p>${escapeHtml(model.standard)}</p>`,
    `<h2>Conformance status</h2>`,
    `<p>${escapeHtml(model.conformanceSentence)}</p>`,
    `<h2>How this website was assessed</h2>`,
    `<p>${escapeHtml(model.assessmentLine)}</p>`,
    `<h2>Known limitations</h2>`,
    limitations,
    `<h2>Reporting a problem</h2>`,
    `<p>${escapeHtml(model.reportingLine)}</p>`,
    `<h2>Contact</h2>`,
    `<p>${escapeHtml(model.contactLine)}</p>`,
    `<h2>Requesting content in another format</h2>`,
    `<p>${escapeHtml(model.alternativeFormatLine)}</p>`,
    `<h2>Date</h2>`,
    `<p>${escapeHtml(model.dateLine)} ${escapeHtml(model.lastReviewed)}</p>`,
    `<p><em>${escapeHtml(model.disclaimer)}</em></p>`,
  ].join("\n");
}

function renderLimitationText(model: StatementModel): string[] {
  if (!model.barriers.length) {
    return ["No measured barriers were supplied with this statement. None have been invented."];
  }
  return model.barriers.flatMap((barrier, index) => [
    `${index + 1}. ${barrier.summary}`,
    `   Reason: ${barrier.reason || "[add why this barrier exists]"}`,
    `   What you can do instead: ${barrier.alternative || "[describe an alternative]"}`,
    `   Being fixed by: ${barrier.plan || "[add a date or owner]"}`,
    ...(barrier.criterion ? [`   Related criterion: ${barrier.criterion}`] : []),
  ]);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
