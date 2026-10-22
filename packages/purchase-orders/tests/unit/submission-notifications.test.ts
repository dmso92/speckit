import { describe, expect, it } from "vitest";
import { buildSubmissionNotification, submissionIdempotencyKey } from "../../src/application/submit-purchase-order.js";

describe("submission notification payload", () => {
  it("uses stable per-channel idempotency keys", () => {
    expect(submissionIdempotencyKey("po-1", "email")).toBe("po-1:purchase_order_submitted:email");
    expect(submissionIdempotencyKey("po-1", "portal")).not.toBe(submissionIdempotencyKey("po-1", "email"));
  });
  it("includes supplier-safe immutable details but no buyer-only data", () => {
    const payload = buildSubmissionNotification({ id: "po-1", orderNumber: "PO-1", branchId: "b1", supplierId: "s1", totalCents: 800, items: [{ productId: "p", productNameSnapshot: "Widget", skuSnapshot: "W-1", quantity: 2, unitPriceCents: 400, lineTotalCents: 800 }] });
    expect(JSON.stringify(payload)).toContain("Widget");
    expect(JSON.stringify(payload)).not.toMatch(/approval|internal|buyer|reason/i);
  });
});
