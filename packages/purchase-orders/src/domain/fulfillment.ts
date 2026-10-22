import { DomainError, type PurchaseOrder, type PurchaseOrderLine, type PurchaseOrderStatus } from "./purchase-order.js";
import { canReceiveShipment, requiresApproval } from "./lifecycle.js";

export interface ShipmentLineInput {
  purchaseOrderLineItemId: string;
  quantity: number;
}

export interface ShipmentLine {
  purchaseOrderLineItemId: string;
  quantity: number;
}

export interface FulfillmentShipment {
  id: string;
  purchaseOrderId: string;
  recordedAt: string;
  recordedBy: string;
  items: ShipmentLine[];
}

export function remainingQuantity(line: Pick<PurchaseOrderLine, "quantity" | "receivedQuantity">): number {
  return line.quantity - (line.receivedQuantity ?? 0);
}

export function deriveFulfillmentStatus(items: Array<Pick<PurchaseOrderLine, "quantity" | "receivedQuantity">>): PurchaseOrderStatus {
  if (items.length === 0) throw new DomainError("A purchase order must contain lines before fulfillment.", "conflict");
  const receivedAny = items.some(item => (item.receivedQuantity ?? 0) > 0);
  const allComplete = items.every(item => (item.receivedQuantity ?? 0) === item.quantity);
  if (allComplete) return "Fulfilled";
  return receivedAny ? "Partially Fulfilled" : "Submitted";
}

export function validateShipment(order: PurchaseOrder, shipmentItems: ShipmentLineInput[]): void {
  if (!canReceiveShipment(order)) throw new DomainError("Order is not eligible for shipment receipt; required approval may be missing or rejected.", "conflict");
  if (!Array.isArray(shipmentItems) || shipmentItems.length === 0) throw new DomainError("A shipment must contain at least one line item.", "validation");

  const byId = new Map(order.items.map(item => [item.id, item]));
  const seen = new Set<string>();
  for (const shipmentItem of shipmentItems) {
    if (!shipmentItem || typeof shipmentItem.purchaseOrderLineItemId !== "string" || !shipmentItem.purchaseOrderLineItemId) {
      throw new DomainError("Each shipment line must reference a purchase-order line item.", "validation");
    }
    if (!Number.isSafeInteger(shipmentItem.quantity) || shipmentItem.quantity <= 0) {
      throw new DomainError("Shipment quantities must be positive whole numbers.", "validation");
    }
    if (seen.has(shipmentItem.purchaseOrderLineItemId)) {
      throw new DomainError("A purchase-order line item may appear only once per shipment.", "validation");
    }
    seen.add(shipmentItem.purchaseOrderLineItemId);
    const line = byId.get(shipmentItem.purchaseOrderLineItemId);
    if (!line) throw new DomainError("Shipment references an unknown purchase-order line item.", "validation");
    if ((line.receivedQuantity ?? 0) + shipmentItem.quantity > line.quantity) {
      throw new DomainError("Shipment quantity would exceed the ordered quantity for a line item.", "validation");
    }
  }
  if (requiresApproval(order.totalCents) && order.approvalDecision?.decision !== "Approved") {
    throw new DomainError("High-value orders require approval before shipment receipt.", "conflict");
  }
}
