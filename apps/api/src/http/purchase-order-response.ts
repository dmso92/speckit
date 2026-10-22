import type { PurchaseOrder } from "@purchase-orders/library";

export function toPurchaseOrderResponse(order: PurchaseOrder) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    branchId: order.branchId,
    supplierId: order.supplierId,
    createdBy: order.createdBy,
    status: order.status,
    currency: order.currency,
    items: order.items.map(item => ({
      id: item.id!,
      productId: item.productId,
      productName: item.productNameSnapshot,
      sku: item.skuSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents
    })),
    totalCents: order.totalCents,
    approvalDecision: order.approvalDecision,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    submittedAt: order.submittedAt,
    fulfilledAt: order.fulfilledAt,
    cancelledAt: order.cancelledAt,
    version: order.version
  };
}

export function toPurchaseOrderPageResponse(page: { items: PurchaseOrder[]; page: number; pageSize: number; total: number }) {
  return { items: page.items.map(toPurchaseOrderResponse), page: page.page, pageSize: page.pageSize, totalItems: page.total };
}
