import { describe, expect, it } from "vitest";
import { canFulfill, requiresApproval, transitionOrder } from "../../src/domain/lifecycle.js";
import type { PurchaseOrder } from "../../src/domain/purchase-order.js";

const order = (totalCents: number, status: PurchaseOrder["status"] = "Submitted"): PurchaseOrder => ({
  id: "po-1", orderNumber: "PO-1", branchId: "branch-1", supplierId: "supplier-1", createdBy: "buyer-1", status, currency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", submittedAt: "2026-01-01T00:00:00.000Z",
  fulfilledAt: null, cancelledAt: null, version: 1, totalCents, items: [], approvalDecision: null
});

describe("purchase-order lifecycle", () => {
  it("requires approval only strictly above 1,000,000 cents", () => {
    expect(requiresApproval(1_000_000)).toBe(false);
    expect(requiresApproval(1_000_001)).toBe(true);
  });
  it("blocks self approval, unauthorized approvers, repeat decisions, rejected fulfillment, and terminal transitions", () => {
    expect(() => transitionOrder(order(1_000_001), { type: "approve", actorId: "buyer-1", isDesignatedApprover: true })).toThrow(/submitter/i);
    expect(() => transitionOrder(order(1_000_001), { type: "approve", actorId: "other", isDesignatedApprover: false })).toThrow(/approver/i);
    expect(canFulfill(order(1_000_001))).toBe(false);
    expect(() => transitionOrder(order(1_000_001, "Fulfilled"), { type: "cancel", actorId: "buyer-1", isDesignatedApprover: false })).toThrow(/terminal/i);
  });
  it("allows low-value fulfillment and records approval for eligible high-value orders", () => {
    expect(transitionOrder(order(1_000_000), { type: "fulfill", actorId: "fulfiller-1", isDesignatedApprover: false }).status).toBe("Fulfilled");
    expect(transitionOrder(order(1_000_001), { type: "approve", actorId: "approver-1", isDesignatedApprover: true }).status).toBe("Approved");
  });
});
