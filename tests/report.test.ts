import { describe, expect, it } from "vitest";
import { fromUnknown, hasUsableReport } from "../lib/report";

describe("report parsing", () => {
  it("deduplicates barriers by stable id before falling back to summary text", () => {
    const report = fromUnknown(
      {
        barriers: [
          { id: "contrast-1", summary: "Low contrast on footer links" },
          { id: "contrast-1", summary: "Footer links do not meet contrast ratio" },
          { summary: "Keyboard trap in menu" },
          { summary: "Keyboard trap in menu" },
        ],
      },
      "json",
    );

    expect(report.barriers).toHaveLength(2);
    expect(report.barriers[0]?.id).toBe("contrast-1");
    expect(report.barriers[1]?.summary).toBe("Keyboard trap in menu");
  });

  it("treats only readable JSON or URL reports as usable checkout evidence", () => {
    expect(hasUsableReport(fromUnknown({ barriers: [] }, "json"))).toBe(true);
    expect(hasUsableReport(fromUnknown({ barriers: [] }, "url"))).toBe(true);
    expect(hasUsableReport({ present: true, source: "unreadable", barriers: [] })).toBe(false);
    expect(hasUsableReport({ present: true, source: "token", barriers: [] })).toBe(false);
  });
});
