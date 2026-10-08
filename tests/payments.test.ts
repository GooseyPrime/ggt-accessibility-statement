import { describe, expect, it } from "vitest";
import {
  canKeepPaidUnlock,
  normalizeAppReturnUrl,
  salePayload,
  shopSaleUrl,
  shopVerifyEndpoint,
  shopVerifyUrl,
} from "../lib/payments";
import { PRODUCT_ID, TOOL_ID } from "../lib/config";

describe("shop payment handshake", () => {
  it("posts toolId and product for the registry stub", () => {
    const payload = salePayload({
      url: "https://riverandoak.example/",
      withReport: true,
      returnUrl: "https://example.test/tools/accessibility-statement?paid=1",
    });
    expect(payload.toolId).toBe(TOOL_ID);
    expect(payload.product).toBe(PRODUCT_ID);
    expect(payload.withReport).toBe(true);
    expect(payload.url).toBe("https://riverandoak.example/");
  });

  it("targets shop sale and verify paths", () => {
    expect(shopSaleUrl("https://www.goldengoosetools.com")).toBe(
      "https://www.goldengoosetools.com/api/sale",
    );
    expect(shopVerifyEndpoint("https://www.goldengoosetools.com")).toBe(
      "https://www.goldengoosetools.com/api/verify",
    );
    expect(shopVerifyUrl("https://www.goldengoosetools.com", "cs_test_1")).toBe(
      "https://www.goldengoosetools.com/api/verify?session_id=cs_test_1",
    );
  });

  it("only accepts return URLs on this app origin", () => {
    expect(
      normalizeAppReturnUrl(
        "https://tool.example/tools/accessibility-statement?session_id=1#paid",
        "https://tool.example/api/sale",
      ),
    ).toBe("https://tool.example/tools/accessibility-statement");
    expect(normalizeAppReturnUrl("/tools/accessibility-statement?session_id=1", "https://tool.example/api/sale")).toBe(
      "https://tool.example/tools/accessibility-statement",
    );
    expect(normalizeAppReturnUrl("https://tool.example/elsewhere", "https://tool.example/api/sale")).toBeNull();
    expect(normalizeAppReturnUrl("https://attacker.example/elsewhere", "https://tool.example/api/sale")).toBeNull();
  });

  it("accepts the shop origin when the tool is served through the shop proxy", () => {
    const proxiedRequest = "https://tool.example/tools/accessibility-statement/api/sale";
    const shop = ["https://shop.example"];

    // What a buyer's browser sends: its own address, which is on the shop.
    expect(
      normalizeAppReturnUrl(
        "https://shop.example/tools/accessibility-statement?canceled=1#top",
        proxiedRequest,
        shop,
      ),
    ).toBe("https://shop.example/tools/accessibility-statement");

    // Without the shop listed this is the refusal that blocked every checkout.
    expect(
      normalizeAppReturnUrl("https://shop.example/tools/accessibility-statement", proxiedRequest),
    ).toBeNull();

    // The path allow-list still applies on the shop origin.
    expect(normalizeAppReturnUrl("https://shop.example/elsewhere", proxiedRequest, shop)).toBeNull();

    // Any other origin is still refused, as is a malformed configured origin.
    expect(
      normalizeAppReturnUrl("https://attacker.example/tools/accessibility-statement", proxiedRequest, shop),
    ).toBeNull();
    expect(
      normalizeAppReturnUrl("https://shop.example/tools/accessibility-statement", proxiedRequest, ["not a url"]),
    ).toBeNull();
  });

  it("keeps the paid unlock only for the purchased site", () => {
    expect(canKeepPaidUnlock("riverandoak.example", "https://riverandoak.example/")).toBe(true);
    expect(canKeepPaidUnlock("https://riverandoak.example/about", "https://riverandoak.example/")).toBe(false);
    expect(canKeepPaidUnlock("riverandoak.example", null)).toBe(false);
  });
});
