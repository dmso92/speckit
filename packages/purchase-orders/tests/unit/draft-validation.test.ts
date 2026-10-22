import { describe, expect, it } from "vitest";
import { calculateTotals, validateDraftInput } from "../../src/domain/purchase-order.js";

describe("purchase-order draft rules", () => {
  it("uses integer cents and server-derived line and order totals", () => {
    const result = calculateTotals([{ productId: "pencil", productNameSnapshot: "Pencil", quantity: 3, unitPriceCents: 125 }]);
    expect(result).toEqual({ items: [{ productId: "pencil", productNameSnapshot: "Pencil", skuSnapshot: null, quantity: 3, unitPriceCents: 125, lineTotalCents: 375 }], totalCents: 375 });
  });

  it("rejects non-positive quantities, negative prices, and unsafe totals", () => {
    expect(() => validateDraftInput({ items: [{ productId: "p", quantity: 0, unitPriceCents: 1 }] })).toThrow(/quantity/i);
    expect(() => validateDraftInput({ items: [{ productId: "p", quantity: 1, unitPriceCents: -1 }] })).toThrow(/price/i);
    expect(() => calculateTotals([{ productId: "p", productNameSnapshot: "P", quantity: Number.MAX_SAFE_INTEGER, unitPriceCents: 2 }])).toThrow(/range/i);
  });

  it("allows an incomplete draft but submission validation requires its references and a line", () => {
    expect(() => validateDraftInput({ items: [] })).not.toThrow();
    expect(() => validateDraftInput({ items: [], requireComplete: true })).toThrow(/line/i);
  });
});
