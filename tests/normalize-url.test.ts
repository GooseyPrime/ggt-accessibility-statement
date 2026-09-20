import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractUrlCandidate, isBlockedHost, normalizeUrl } from "../lib/normalize-url";

const messy = readFileSync(resolve(__dirname, "../fixtures/messy-url.txt"), "utf8");

describe("normalizeUrl", () => {
  it("keeps a clean marketing URL", () => {
    const result = normalizeUrl("https://riverandoak.example/");
    expect(result.href).toBe("https://riverandoak.example/");
    expect(result.error).toBeUndefined();
  });

  it("accepts a host without a scheme", () => {
    const result = normalizeUrl("nightmarket.example");
    expect(result.href).toBe("https://nightmarket.example/");
  });

  it("strips trailing junk from a pasted URL", () => {
    const result = normalizeUrl(messy);
    expect(result.href).toBe("https://riverandoak.example/contact/");
    expect(result.note).toMatch(/extra words/i);
  });

  it("extracts a URL buried in slack-style paste", () => {
    expect(extractUrlCandidate("www.nightmarket.example/index.html?utm=1 copied from slack")).toBe(
      "www.nightmarket.example/index.html?utm=1",
    );
    const result = normalizeUrl("www.nightmarket.example/index.html?utm=1 copied from slack");
    expect(result.href).toBe("https://www.nightmarket.example/index.html?utm=1");
  });

  it("rejects empty, blocked, and hostnames without a dot", () => {
    expect(normalizeUrl("").error).toMatch(/website address/i);
    expect(normalizeUrl("localhost").error).toMatch(/cannot be checked|website address/i);
    expect(normalizeUrl("this").error).toMatch(/website address/i);
    expect(isBlockedHost("127.0.0.1")).toBe(true);
    expect(isBlockedHost("192.168.1.8")).toBe(true);
    expect(isBlockedHost("[fd00::1]")).toBe(true);
    expect(isBlockedHost("[fe80::1]")).toBe(true);
    expect(isBlockedHost("[::ffff:127.0.0.1]")).toBe(true);
    expect(isBlockedHost("[::ffff:8.8.8.8]")).toBe(false);
    expect(isBlockedHost("[2001:4860::1]")).toBe(false);
    expect(isBlockedHost("riverandoak.example")).toBe(false);
  });
});
