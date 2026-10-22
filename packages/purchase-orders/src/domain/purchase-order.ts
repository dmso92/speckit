export type PurchaseOrderStatus = "Draft" | "Submitted" | "Approved" | "Partially Fulfilled" | "Fulfilled" | "Cancelled";
export type ApprovalValue = "Approved" | "Rejected";

export interface DraftLineInput {
  productId: string;
  productNameSnapshot?: string;
  skuSnapshot?: string | null;
  quantity: number;
  unitPriceCents: number;
}

export interface PurchaseOrderLine extends DraftLineInput {
  id?: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  lineTotalCents: number;
  receivedQuantity?: number;
  remainingQuantity?: number;
}

export interface DraftInput {
  branchId: string | null;
  supplierId: string | null;
  createdBy: string;
  items: DraftLineInput[];
}

export interface DraftUpdate {
  branchId?: string | null;
  supplierId?: string | null;
  items?: DraftLineInput[];
}

export interface ApprovalDecision {
  approverId: string;
  decision: ApprovalValue;
  reason: string | null;
  decidedAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  branchId: string | null;
  supplierId: string | null;
  createdBy: string;
  status: PurchaseOrderStatus;
  currency: "USD";
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  version: number;
  totalCents: number;
  items: PurchaseOrderLine[];
  approvalDecision: ApprovalDecision | null;
}

export class DomainError extends Error {
  constructor(message: string, public readonly code: "validation" | "conflict" | "forbidden" | "not_found" = "validation") {
    super(message);
    this.name = "DomainError";
  }
}

export function validateDraftInput(input: { items: DraftLineInput[]; branchId?: string | null; supplierId?: string | null; requireComplete?: boolean }): void {
  if (!Array.isArray(input.items)) throw new DomainError("Line items must be an array.");
  if (input.requireComplete && !input.branchId) throw new DomainError("A branch is required before submission.");
  if (input.requireComplete && !input.supplierId) throw new DomainError("A supplier is required before submission.");
  if (input.requireComplete && input.items.length === 0) throw new DomainError("At least one line item is required before submission.");
  for (const item of input.items) {
    if (!item.productId?.trim()) throw new DomainError("Each line item must reference a product.");
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new DomainError("Quantity must be a positive whole number.");
    if (!Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0) throw new DomainError("Unit price must be a non-negative whole number of cents.");
  }
  calculateTotals(input.items);
}

export function calculateTotals(items: DraftLineInput[]): { items: PurchaseOrderLine[]; totalCents: number } {
  let totalCents = 0;
  const calculated = items.map(item => {
    const lineTotalCents = item.quantity * item.unitPriceCents;
    if (!Number.isSafeInteger(lineTotalCents)) throw new DomainError("Calculated line total exceeds the supported integer range.");
    totalCents += lineTotalCents;
    if (!Number.isSafeInteger(totalCents)) throw new DomainError("Calculated order total exceeds the supported integer range.");
    return {
      ...item,
      productNameSnapshot: item.productNameSnapshot?.trim() || item.productId,
      skuSnapshot: item.skuSnapshot ?? null,
      lineTotalCents
    };
  });
  return { items: calculated, totalCents };
}
