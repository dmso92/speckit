import type { PurchaseOrder } from "./api.js";
import { formatMoney } from "./api.js";

export function PurchaseOrderDetailPage({ order, actorKind, onSubmit, onEdit, onFulfill, onCancel }: {
  order: PurchaseOrder;
  actorKind: "buyer" | "fulfiller";
  onSubmit: () => void;
  onEdit: () => void;
  onFulfill: () => void;
  onCancel: () => void;
}) {
  return <section aria-labelledby="order-detail-heading" className="order-detail">
    <h2 id="order-detail-heading">{order.orderNumber}</h2>
    <p><strong>Status:</strong> <span>{order.status}</span></p>
    {order.approvalDecision && <p><strong>Decision:</strong> {order.approvalDecision.decision} by {order.approvalDecision.approverId} at {new Date(order.approvalDecision.decidedAt).toLocaleString()}
      {order.approvalDecision.reason ? ` — ${order.approvalDecision.reason}` : ""}
    </p>}
    <p><strong>Branch:</strong> {order.branchId ?? "Not selected"} · <strong>Supplier:</strong> {order.supplierId ?? "Not selected"}</p>
    <table>
      <thead><tr><th scope="col">Product</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
      <tbody>{order.items.map(item => <tr key={item.id ?? item.productId}>
        <td>{item.productName}</td><td>{item.quantity}</td><td>{formatMoney(item.unitPriceCents)}</td><td>{formatMoney(item.lineTotalCents)}</td>
      </tr>)}</tbody>
    </table>
    <p className="total">Total: {formatMoney(order.totalCents)}</p>
    <div className="actions">
      {actorKind === "buyer" && order.status === "Draft" && <button onClick={onSubmit}>Submit order</button>}
      {actorKind === "buyer" && order.status === "Draft" && <button className="secondary" onClick={onEdit}>Save draft changes</button>}
      {actorKind === "fulfiller" && (order.status === "Submitted" || order.status === "Approved") && <button onClick={onFulfill}>Mark fulfilled</button>}
      {actorKind === "buyer" && ["Draft", "Submitted", "Approved"].includes(order.status) && <button className="secondary" onClick={onCancel}>Cancel order</button>}
    </div>
  </section>;
}
