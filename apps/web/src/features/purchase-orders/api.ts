export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface ShipmentLineInput {
  purchaseOrderLineItemId: string;
  quantity: number;
}

export interface FulfillmentShipment {
  id: string;
  purchaseOrderId: string;
  recordedAt: string;
  recordedBy: string;
  items: ShipmentLineInput[];
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  branchId: string | null;
  supplierId: string | null;
  createdBy: string;
  status: "Draft" | "Submitted" | "Approved" | "Partially Fulfilled" | "Fulfilled" | "Cancelled";
  totalCents: number;
  items: PurchaseOrderItem[];
  approvalDecision: { decision: "Approved" | "Rejected"; approverId: string; decidedAt: string; reason: string | null } | null;
}

export interface SupplierNotification {
  id: string;
  purchaseOrderId: string;
  orderNumber: string;
  totalCents: number;
  summary: Array<{ productName: string; quantity: number; unitPriceCents: number; lineTotalCents: number }>;
  readAt: string | null;
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export const purchaseOrderApi = {
  list(token: string) {
    return api<{ items: PurchaseOrder[] }>("/purchase-orders", token);
  },
  create(token: string, input: { branchId: string; supplierId: string; items: Array<{ productId: string; quantity: number; unitPriceCents: number }> }) {
    return api<PurchaseOrder>("/purchase-orders", token, { method: "POST", body: JSON.stringify(input) });
  },
  update(token: string, id: string, input: { branchId: string; supplierId: string; items: Array<{ productId: string; quantity: number; unitPriceCents: number }> }) {
    return api<PurchaseOrder>(`/purchase-orders/${id}`, token, { method: "PATCH", body: JSON.stringify(input) });
  },
  submit(token: string, id: string) {
    return api<PurchaseOrder>(`/purchase-orders/${id}/submit`, token, { method: "POST" });
  },
  decide(token: string, id: string, decision: "Approved" | "Rejected") {
    return api<PurchaseOrder>(`/purchase-orders/${id}/approval-decisions`, token, { method: "POST", body: JSON.stringify({ decision }) });
  },
  fulfill(token: string, id: string, items: ShipmentLineInput[]) {
    return api<PurchaseOrder>(`/purchase-orders/${id}/fulfill`, token, { method: "POST", body: JSON.stringify({ items }) });
  },
  fulfillmentHistory(token: string, id: string) {
    return api<{ purchaseOrderId: string; shipments: FulfillmentShipment[] }>(`/purchase-orders/${id}/fulfillment-history`, token);
  },
  cancel(token: string, id: string) {
    return api<PurchaseOrder>(`/purchase-orders/${id}/cancel`, token, { method: "POST" });
  },
  notifications(token: string) {
    return api<{ items: SupplierNotification[] }>("/supplier-notifications", token);
  },
  markRead(token: string, id: string) {
    return api<void>(`/supplier-notifications/${id}/read`, token, { method: "POST" });
  }
};

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
