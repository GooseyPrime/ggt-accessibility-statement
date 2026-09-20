import { describe, expect, it } from "vitest";
import { readPriceCents, selectedPrice, shopPrices } from "../lib/prices";

describe("shop-mirrored prices", () => {
  it("does not invent Cos prices when env is empty", () => {
    expect(readPriceCents(undefined)).toBeNull();
    expect(shopPrices({}).aloneCents).toBeNull();
    expect(selectedPrice({ aloneCents: null, withReportCents: null }, false)).toBeNull();
  });

  it("reads cents from env and formats USD", () => {
    const prices = shopPrices({
      NEXT_PUBLIC_PRICE_CENTS: "2900",
      NEXT_PUBLIC_PRICE_WITH_REPORT_CENTS: "1900",
    });
    expect(prices.aloneCents).toBe(2900);
    expect(prices.withReportCents).toBe(1900);
    expect(selectedPrice(prices, false)?.label).toBe("$29.00");
    expect(selectedPrice(prices, true)?.label).toBe("$19.00");
  });

  it("rejects non-integer or non-positive values", () => {
    expect(readPriceCents("29.00")).toBeNull();
    expect(readPriceCents("-100")).toBeNull();
    expect(readPriceCents("free")).toBeNull();
  });
});
