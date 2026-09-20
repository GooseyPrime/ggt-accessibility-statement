import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractSiteFacts } from "../lib/inspect-html";
import { fromUnknown } from "../lib/report";
import { scoreReadiness } from "../lib/readiness";
import { buildStatement, renderHtml, renderPlainText } from "../lib/statement";

const cleanHtml = readFileSync(resolve(__dirname, "../fixtures/clean-marketing.html"), "utf8");
const failing = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/report-failing.json"), "utf8"),
);

describe("paid statement renderers", () => {
  const facts = extractSiteFacts(cleanHtml, "https://riverandoak.example/", "https://riverandoak.example/");
  const report = fromUnknown(failing, "json");
  const readiness = scoreReadiness({
    facts,
    report,
    now: new Date("2026-09-20T12:00:00Z"),
    defaultStandard: "WCAG 2.2 Level AA",
    standardChecked: "2026-09-19",
    answers: {
      alternativeFormatHow: "Email hello@riverandoak.example and ask for another format.",
      limitationPlans: { "img-alt": "Friday 2 October" },
    },
  });
  const model = buildStatement({ facts, report, readiness, answers: readiness && {
    alternativeFormatHow: "Email hello@riverandoak.example and ask for another format.",
    limitationPlans: { "img-alt": "Friday 2 October" },
  } });

  it("uses measured barriers and the editable plan line", () => {
    const text = renderPlainText(model);
    expect(text).toMatch(/Product photos have no text alternative/);
    expect(text).toMatch(/Being fixed by: Friday 2 October/);
    expect(text).toMatch(/not conformant/i);
    expect(text).not.toMatch(/is fully conformant/i);
    expect(text).toMatch(/general information, not legal advice/i);
  });

  it("emits HTML with a correct heading outline", () => {
    const html = renderHtml(model);
    expect(html).toMatch(/<h1>Accessibility statement for River &amp; Oak Outfitters<\/h1>/);
    expect(html).toMatch(/<h2>Conformance status<\/h2>/);
    expect(html).toMatch(/<h2>Known limitations<\/h2>/);
    expect(html).toMatch(/<h3>Product photos have no text alternative<\/h3>/);
    expect(html).toMatch(/<h2>Requesting content in another format<\/h2>/);
  });

  it("leaves a marked blank instead of inventing an alternative", () => {
    const barren = fromUnknown(
      {
        ...failing,
        barriers: [{ id: "x", summary: "A measured barrier with no workaround" }],
      },
      "json",
    );
    const next = scoreReadiness({
      facts,
      report: barren,
      now: new Date("2026-09-20T12:00:00Z"),
      defaultStandard: "WCAG 2.2 Level AA",
      standardChecked: "2026-09-19",
    });
    const text = renderPlainText(buildStatement({ facts, report: barren, readiness: next }));
    expect(text).toMatch(/\[describe an alternative\]/);
    expect(text).not.toMatch(/We can offer a workaround for every visitor/);
  });
});
