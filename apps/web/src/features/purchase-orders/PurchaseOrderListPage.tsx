import type { PurchaseOrder } from "./api.js";

export function PurchaseOrderListPage({ orders, selectedId, onSelect }: { orders: PurchaseOrder[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (orders.length === 0) return <p className="empty-state">No purchase orders yet.</p>;
  return <ul className="order-list" aria-label="Purchase orders">
    {orders.map(order => <li key={order.id}>
      <button className={selectedId === order.id ? "order-row selected" : "order-row"} onClick={() => onSelect(order.id)}>
        <span><strong>{order.orderNumber}</strong><small>{order.supplierId ?? "Supplier not selected"}</small></span>
        <span className="status">{order.status}</span>
      </button>
    </li>)}
  </ul>;
}
