import { describe, expect, it } from "vitest";
import {
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
});
