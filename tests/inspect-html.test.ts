import { describe, expect, it } from "vitest";
import { extractSiteFacts } from "../lib/inspect-html";

describe("extractSiteFacts", () => {
  it("filters extracted links to allowed schemes", () => {
    const facts = extractSiteFacts(
      `
        <html>
          <head><title>Example</title></head>
          <body>
            <a href="javascript:alert(1)">Contact us</a>
            <a href="mailto:help@example.test">Report a problem</a>
            <a href="ftp://example.test/accessibility">Accessibility statement</a>
          </body>
        </html>
      `,
      "https://example.test/",
      "https://example.test/",
    );

    expect(facts.contactUrl).toBeNull();
    expect(facts.feedbackUrl).toBe("mailto:help@example.test");
    expect(facts.accessibilityPageUrl).toBeNull();
  });
});
