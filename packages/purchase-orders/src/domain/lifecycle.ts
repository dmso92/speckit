import { DomainError, type ApprovalValue, type PurchaseOrder, type PurchaseOrderStatus } from "./purchase-order.js";

export type LifecycleCommand =
  | { type: "approve" | "reject"; actorId: string; isDesignatedApprover: boolean; reason?: string | null }
  | { type: "fulfill" | "cancel"; actorId: string; isDesignatedApprover: boolean };

export function requiresApproval(totalCents: number): boolean {
  return totalCents > 1_000_000;
}

export function canFulfill(order: PurchaseOrder): boolean {
  if (order.status === "Approved") return order.approvalDecision?.decision === "Approved";
  if (order.status !== "Submitted") return false;
  return !requiresApproval(order.totalCents) && order.approvalDecision?.decision !== "Rejected";
}

export function canReceiveShipment(order: PurchaseOrder): boolean {
  if (order.status === "Partially Fulfilled") return true;
  return canFulfill(order);
}

export function transitionOrder(order: PurchaseOrder, command: LifecycleCommand): PurchaseOrder {
  const now = new Date().toISOString();
  let status: PurchaseOrderStatus = order.status;
  let approvalDecision = order.approvalDecision;
  if (order.status === "Fulfilled" || order.status === "Cancelled") throw new DomainError("Terminal orders cannot be changed.", "conflict");

  if (command.type === "approve" || command.type === "reject") {
    if (order.status !== "Submitted" || !requiresApproval(order.totalCents)) throw new DomainError("Only submitted orders over $10,000 require a decision.", "conflict");
    if (!command.isDesignatedApprover) throw new DomainError("A designated organization-wide approver is required.", "forbidden");
    if (command.actorId === order.createdBy) throw new DomainError("The submitting buyer cannot approve or reject their own order.", "forbidden");
    if (approvalDecision) throw new DomainError("An approval decision is final and already exists.", "conflict");
    const decision: ApprovalValue = command.type === "approve" ? "Approved" : "Rejected";
    approvalDecision = { approverId: command.actorId, decision, reason: command.reason ?? null, decidedAt: now };
    if (decision === "Approved") status = "Approved";
  } else if (command.type === "fulfill") {
    if (!canFulfill(order)) throw new DomainError("Order is not eligible for fulfillment; required approval may be missing or rejected.", "conflict");
    status = "Fulfilled";
  } else {
    if (!["Draft", "Submitted", "Approved", "Partially Fulfilled"].includes(order.status)) throw new DomainError("Order cannot be cancelled from its current state.", "conflict");
    status = "Cancelled";
  }
  return {
    ...order,
    status,
    approvalDecision,
    fulfilledAt: status === "Fulfilled" ? now : order.fulfilledAt,
    cancelledAt: status === "Cancelled" ? now : order.cancelledAt,
    updatedAt: now,
    version: order.version + 1
  };
}
