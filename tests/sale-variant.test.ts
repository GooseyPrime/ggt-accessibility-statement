import { describe, expect, it } from "vitest";
import { salePayload } from "@/lib/payments";

describe("sale payload variant", () => {
  it("asks the shop for the renewal price only when a report is attached", () => {
    const base = { url: "https://example.com", returnUrl: "https://www.goldengoosetools.com/tools/accessibility-statement" };
    expect(salePayload({ ...base, withReport: true }).variant).toBe("renewal");
    expect(salePayload({ ...base, withReport: false }).variant).toBe("standard");
    expect(salePayload({ ...base, withReport: false }).product).toBe("a11y-statement");
  });
});

describe("verify product match", () => {
  it("does not unlock on a paid session bought for another product", async () => {
    const { verifySale } = await import("@/lib/payments");
    const prev = process.env.NEXT_PUBLIC_SHOP_ORIGIN;
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://shop.test";
    const real = globalThis.fetch;
    const reply = (product: string) =>
      (globalThis.fetch = (async () =>
        new Response(JSON.stringify({ ok: true, paid: true, product }), { status: 200 })) as typeof fetch);
    try {
      reply("seo-audit");
      expect((await verifySale("cs_test_1")).paid).toBe(false);
      reply("a11y-statement");
      expect((await verifySale("cs_test_2")).paid).toBe(true);
    } finally {
      globalThis.fetch = real;
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SHOP_ORIGIN;
      else process.env.NEXT_PUBLIC_SHOP_ORIGIN = prev;
    }
  });
});
