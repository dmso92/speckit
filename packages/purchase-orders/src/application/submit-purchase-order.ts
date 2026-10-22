import type { SubmissionNotification } from "../ports/notifications.js";
import { DomainError, type PurchaseOrder } from "../domain/purchase-order.js";
import type { Actor } from "../ports/actor.js";
import type { AuthorizationPort } from "../ports/authorization.js";
import { defaultAuthorization } from "../ports/authorization.js";
import type { CatalogPort } from "../ports/catalog.js";
import type { PurchaseOrderRepository } from "../sqlite/purchase-order-repository.js";

export function submissionIdempotencyKey(purchaseOrderId: string, channel: "email" | "portal"): string {
  return `${purchaseOrderId}:purchase_order_submitted:${channel}`;
}

export function buildSubmissionNotification(order: Pick<PurchaseOrder, "id" | "orderNumber" | "branchId" | "supplierId" | "totalCents" | "items">): SubmissionNotification {
  return {
    purchaseOrderId: order.id,
    orderNumber: order.orderNumber,
    branchId: order.branchId ?? "",
    supplierId: order.supplierId ?? "",
    totalCents: order.totalCents,
    items: order.items.map(item => ({
      productName: item.productNameSnapshot,
      sku: item.skuSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents
    }))
  };
}

export class SubmitPurchaseOrder {
  constructor(
    private readonly repository: PurchaseOrderRepository,
    private readonly catalog: CatalogPort,
    private readonly authorization: AuthorizationPort = defaultAuthorization
  ) {}

  async submit(actor: Actor, id: string): Promise<PurchaseOrder> {
    const order = this.repository.get(id);
    if (!order) throw new DomainError("Purchase order was not found.", "not_found");
    if (!this.authorization.canManageOrder(actor, order.createdBy, order.branchId ?? "")) {
      throw new DomainError("Buyer is not authorized to submit this order.", "forbidden");
    }
    if (!order.branchId || !order.supplierId) throw new DomainError("Branch and supplier are required before submission.");
    const [branch, supplier, contact] = await Promise.all([
      this.catalog.validateReference("branch", order.branchId),
      this.catalog.validateReference("supplier", order.supplierId),
      this.catalog.getSupplierContact(order.supplierId)
    ]);
    if (!branch || !supplier || !contact) throw new DomainError("Branch, supplier, or supplier contact is unavailable from the host catalog.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) throw new DomainError("Supplier catalog returned an invalid email address.");
    for (const item of order.items) {
      if (!await this.catalog.getProduct(item.productId)) throw new DomainError(`Product ${item.productId} is no longer available from the host catalog.`);
    }
    return this.repository.submit(id, { recipient: contact.email, expectedVersion: order.version });
  }
}
