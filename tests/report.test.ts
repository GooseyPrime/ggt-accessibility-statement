import { describe, expect, it } from "vitest";
import { fromUnknown } from "../lib/report";

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
});
