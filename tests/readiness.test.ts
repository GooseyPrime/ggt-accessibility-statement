import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractSiteFacts } from "../lib/inspect-html";
import { emptyReport, fromUnknown } from "../lib/report";
import { normalizeUrl } from "../lib/normalize-url";
import { scoreReadiness } from "../lib/readiness";
import type { SiteFacts } from "../lib/types";

const cleanHtml = readFileSync(resolve(__dirname, "../fixtures/clean-marketing.html"), "utf8");
const noContactHtml = readFileSync(resolve(__dirname, "../fixtures/no-contact.html"), "utf8");
const messy = readFileSync(resolve(__dirname, "../fixtures/messy-url.txt"), "utf8");
const failing = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/report-failing.json"), "utf8"),
);

const NOW = new Date("2026-09-20T12:00:00Z");
const STANDARD = "WCAG 2.2 Level AA";
const CHECKED = "2026-09-19";

function score(facts: SiteFacts, report = emptyReport(), answers?: Parameters<typeof scoreReadiness>[0]["answers"]) {
  return scoreReadiness({
    facts,
    report,
    answers,
    now: NOW,
    defaultStandard: STANDARD,
    standardChecked: CHECKED,
  });
}

describe("readiness score out of 9", () => {
  it("scores a clean marketing site with contact as 6/9", () => {
    const facts = extractSiteFacts(cleanHtml, "https://riverandoak.example/", "https://riverandoak.example/");
    const result = score(facts);
    expect(facts.emails).toContain("hello@riverandoak.example");
    expect(facts.contactUrl).toContain("/contact");
    expect(result.score).toBe(6);
    expect(result.total).toBe(9);
    expect(filledIds(result)).toEqual([
      "site",
      "standard",
      "conformance",
      "reporting",
      "contact",
      "date",
    ]);
    expect(missingIds(result)).toEqual(["assessment", "limitations", "alternativeFormat"]);
    expect(result.conformance).toBe("not_assessed");
  });

  it("scores a site with no contact or a11y info as 4/9", () => {
    const facts = extractSiteFacts(noContactHtml, "https://nightmarket.example/", "https://nightmarket.example/");
    const result = score(facts);
    expect(facts.emails).toEqual([]);
    expect(facts.contactUrl).toBeNull();
    expect(result.score).toBe(4);
    expect(filledIds(result)).toEqual(["site", "standard", "conformance", "date"]);
    expect(missingIds(result)).toEqual([
      "assessment",
      "limitations",
      "reporting",
      "contact",
      "alternativeFormat",
    ]);
  });

  it("scores a messy trailing-junk URL the same as the clean site once normalized", () => {
    const normalized = normalizeUrl(messy);
    expect(normalized.href).toBe("https://riverandoak.example/contact/");
    const clean = extractSiteFacts(cleanHtml, "https://riverandoak.example/", "https://riverandoak.example/");
    const messyFacts = extractSiteFacts(cleanHtml, normalized.href!, messy);
    messyFacts.normalizeNote = normalized.note;
    expect(score(messyFacts).score).toBe(score(clean).score);
  });

  it("fills assessment and limitations from a real failing report without upgrading status", () => {
    const facts = extractSiteFacts(cleanHtml, "https://riverandoak.example/", "https://riverandoak.example/");
    const report = fromUnknown(failing, "json");
    const result = score(facts, report);
    expect(result.score).toBe(8);
    expect(result.conformance).toBe("not_conformant");
    expect(missingIds(result)).toEqual(["alternativeFormat"]);
    expect(result.parts.find((p) => p.id === "limitations")?.filled).toBe(true);
  });

  it("counts a barrier-free report loaded from a URL as complete", () => {
    const facts = extractSiteFacts(cleanHtml, "https://riverandoak.example/", "https://riverandoak.example/");
    const report = fromUnknown(
      {
        conformance: "fully_conformant",
        passed: true,
        method: "Manual audit",
        assessedAt: "2026-09-19",
        barriers: [],
      },
      "url",
    );
    const result = score(facts, report);
    expect(result.conformance).toBe("fully_conformant");
    expect(result.parts.find((p) => p.id === "limitations")?.filled).toBe(true);
  });

  it("lets buyer answers fill the remaining parts without inventing barriers", () => {
    const facts = extractSiteFacts(noContactHtml, "https://nightmarket.example/", "https://nightmarket.example/");
    const result = score(facts, emptyReport(), {
      contactDetails: "hello@nightmarket.example",
      reportingPath: "Email hello@nightmarket.example",
      alternativeFormatHow: "Email hello@nightmarket.example and ask for a large-print copy.",
    });
    expect(result.score).toBe(7);
    expect(result.parts.find((p) => p.id === "limitations")?.filled).toBe(false);
    expect(result.parts.find((p) => p.id === "limitations")?.summary).toMatch(/will not invent/i);
  });
});

function filledIds(result: ReturnType<typeof score>) {
  return result.parts.filter((p) => p.filled).map((p) => p.id);
}

function missingIds(result: ReturnType<typeof score>) {
  return result.missing.map((p) => p.id);
}
