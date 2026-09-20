import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decideConformance } from "../lib/conformance";
import { emptyReport, fromUnknown, parseReportInput } from "../lib/report";
import { renderPlainText } from "../lib/statement";
import { buildStatement } from "../lib/statement";
import { scoreReadiness } from "../lib/readiness";
import type { SiteFacts } from "../lib/types";

const failing = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/report-failing.json"), "utf8"),
);
const upgraded = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/report-fully-with-barriers.json"), "utf8"),
);

const blankFacts: SiteFacts = {
  inputUrl: "https://nightmarket.example",
  normalizedUrl: "https://nightmarket.example/",
  fetchOk: true,
  siteName: "Night Market",
  pageTitle: "Night Market",
  contactUrl: null,
  feedbackUrl: null,
  emails: [],
  phones: [],
  accessibilityPageUrl: null,
};

describe("never upgrade conformance", () => {
  it("is not assessed when no report is present", () => {
    const decision = decideConformance(emptyReport());
    expect(decision.status).toBe("not_assessed");
  });

  it("keeps a failing report as not conformant", () => {
    const report = fromUnknown(failing, "json");
    expect(decideConformance(report).status).toBe("not_conformant");
  });

  it("refuses to honour a full-conformance claim when barriers are listed", () => {
    const report = fromUnknown(upgraded, "json");
    expect(report.claimedConformance).toBe("fully_conformant");
    expect(decideConformance(report).status).toBe("partially_conformant");
  });

  it("never writes fully conformant into a statement without evidence", () => {
    const readiness = scoreReadiness({
      facts: blankFacts,
      report: emptyReport(),
      defaultStandard: "WCAG 2.2 Level AA",
      standardChecked: "2026-09-19",
      now: new Date("2026-09-20T12:00:00Z"),
    });
    const text = renderPlainText(
      buildStatement({
        facts: blankFacts,
        report: emptyReport(),
        readiness,
      }),
    );
    expect(readiness.conformance).toBe("not_assessed");
    expect(text.toLowerCase()).not.toMatch(/is fully conformant/);
    expect(text.toLowerCase()).not.toMatch(/website is fully/);
    expect(text).toMatch(/not been assessed/i);
    expect(text).toMatch(/no full-conformance claim/i);
  });

  it("does not let a buyer-shaped claim raise a failed report", () => {
    const report = fromUnknown({ ...failing, conformance: "fully_conformant" }, "json");
    expect(decideConformance(report).status).not.toBe("fully_conformant");
    expect(["not_conformant", "partially_conformant"]).toContain(decideConformance(report).status);
  });

  it("treats an unreadable pasted report as not assessed", () => {
    const report = parseReportInput("this is not json and not a url");
    expect(report.source).toBe("unreadable");
    expect(decideConformance(report).status).toBe("not_assessed");
  });
});
