import type { PurchaseOrder, DraftInput, DraftUpdate } from "../domain/purchase-order.js";

export interface PurchaseOrderRepositoryPort {
  createDraft(input: DraftInput): PurchaseOrder;
  get(id: string): PurchaseOrder | null;
  updateDraft(id: string, input: DraftUpdate): PurchaseOrder;
}
