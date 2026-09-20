import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectSite } from "../lib/inspect-site";

describe("inspectSite fetch hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects redirects to blocked page targets before following them", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/private" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await inspectSite({ url: "https://riverandoak.example" });

    expect(result.facts.fetchOk).toBe(false);
    expect(result.facts.fetchError).toBe("That address cannot be checked from this tool.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized page responses before parsing them", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response("x".repeat(600_000), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await inspectSite({ url: "https://riverandoak.example" });

    expect(result.facts.fetchOk).toBe(false);
    expect(result.facts.fetchError).toBe("That address returned too much data for this tool.");
  });

  it("rejects redirects to blocked report targets before following them", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<html><title>River & Oak</title></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/report.json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await inspectSite({
      url: "https://riverandoak.example",
      reportText: "https://reports.example/report.json",
    });

    expect(result.report.source).toBe("unreadable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
