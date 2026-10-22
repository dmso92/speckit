import { describe, expect, it } from "vitest";
import { deriveFulfillmentStatus, remainingQuantity, validateShipment } from "../../src/domain/fulfillment.js";
import type { PurchaseOrder } from "../../src/domain/purchase-order.js";

const order = (status: PurchaseOrder["status"] = "Submitted"): PurchaseOrder => ({
  id: "po-1", orderNumber: "PO-1", branchId: "branch-1", supplierId: "supplier-1", createdBy: "buyer-1", status, currency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", submittedAt: "2026-01-01T00:00:00.000Z",
  fulfilledAt: null, cancelledAt: null, version: 1, totalCents: 30,
  items: [
    { id: "line-1", productId: "p1", productNameSnapshot: "Part 1", skuSnapshot: null, quantity: 3, receivedQuantity: 0, unitPriceCents: 10, lineTotalCents: 30 }
  ],
  approvalDecision: null
});

describe("partial fulfillment domain rules", () => {
  it("requires a non-empty shipment with positive whole quantities for known lines", () => {
    const po = order();
    expect(() => validateShipment(po, [])).toThrow(/at least one|non-empty/i);
    expect(() => validateShipment(po, [{ purchaseOrderLineItemId: "line-1", quantity: 0 }])).toThrow(/positive whole/i);
    expect(() => validateShipment(po, [{ purchaseOrderLineItemId: "line-1", quantity: 1.5 }])).toThrow(/positive whole/i);
    expect(() => validateShipment(po, [{ purchaseOrderLineItemId: "unknown", quantity: 1 }])).toThrow(/line item/i);
    expect(() => validateShipment(po, [{ purchaseOrderLineItemId: "line-1", quantity: -1 }])).toThrow(/positive whole/i);
  });

  it("rejects cumulative over-receipt and permits exact completion", () => {
    const po = order();
    validateShipment(po, [{ purchaseOrderLineItemId: "line-1", quantity: 2 }]);
    expect(() => validateShipment({ ...po, items: [{ ...po.items[0]!, receivedQuantity: 2 }] }, [{ purchaseOrderLineItemId: "line-1", quantity: 2 }])).toThrow(/exceed/i);
    expect(remainingQuantity({ ...po.items[0]!, receivedQuantity: 2 })).toBe(1);
  });

  it("derives Submitted, Partially Fulfilled, and Fulfilled only from cumulative quantities", () => {
    expect(deriveFulfillmentStatus([{ quantity: 3, receivedQuantity: 0 }])).toBe("Submitted");
    expect(deriveFulfillmentStatus([{ quantity: 3, receivedQuantity: 1 }])).toBe("Partially Fulfilled");
    expect(deriveFulfillmentStatus([{ quantity: 1, receivedQuantity: 1 }, { quantity: 2, receivedQuantity: 2 }])).toBe("Fulfilled");
  });

  it("allows remaining shipments only when approval requirements are satisfied and allows partial cancellation", () => {
    expect(() => validateShipment({
      ...order("Approved"), approvalDecision: { decision: "Approved", approverId: "approver", reason: null, decidedAt: "2026-01-01T00:00:00.000Z" }
    }, [{ purchaseOrderLineItemId: "line-1", quantity: 1 }])).not.toThrow();
    expect(() => validateShipment(order("Partially Fulfilled"), [{ purchaseOrderLineItemId: "line-1", quantity: 1 }])).not.toThrow();
    expect(() => validateShipment(order("Cancelled"), [{ purchaseOrderLineItemId: "line-1", quantity: 1 }])).toThrow();
    expect(() => validateShipment({
      ...order(), totalCents: 1_000_001,
      items: [{ ...order().items[0]!, quantity: 1, unitPriceCents: 1_000_001, lineTotalCents: 1_000_001 }]
    }, [{ purchaseOrderLineItemId: "line-1", quantity: 1 }])).toThrow(/approval/i);
    const cancelled = { ...order("Partially Fulfilled"), status: "Cancelled" as const, items: [{ ...order().items[0]!, receivedQuantity: 2 }] };
    expect(remainingQuantity(cancelled.items[0]!)).toBe(1);
    expect(deriveFulfillmentStatus(cancelled.items)).toBe("Partially Fulfilled");
  });
});
