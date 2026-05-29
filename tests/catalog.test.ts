import { describe, expect, it } from "vitest";

import { PRODUCT_CATALOG, PRODUCT_FEATURES, isCatalogFeature } from "@/lib/catalog";

describe("product catalog", () => {
  it("exposes the expected allowlist", () => {
    expect(PRODUCT_FEATURES).toEqual([
      "Reviews",
      "Webchat",
      "Messaging",
      "Payments",
      "Phones",
      "AI",
    ]);
    expect(Object.keys(PRODUCT_CATALOG)).toEqual(PRODUCT_FEATURES);
  });

  it("rejects invented feature names", () => {
    expect(isCatalogFeature("Webchat")).toBe(true);
    expect(isCatalogFeature("Analytics")).toBe(false);
  });
});
