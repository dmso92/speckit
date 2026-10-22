import type { PurchaseOrder } from "./api.js";

export function ApprovalQueuePage({ orders, actorId, onApprove, onReject }: { orders: PurchaseOrder[]; actorId: string; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const pending = orders.filter(order => order.status === "Submitted" && order.totalCents > 1_000_000 && order.createdBy !== actorId);
  const selfSubmitted = orders.some(order => order.status === "Submitted" && order.totalCents > 1_000_000 && order.createdBy === actorId);
  if (pending.length === 0) return <section><p className="empty-state">No high-value orders are awaiting a decision.</p>
    {selfSubmitted && <p role="status">Your own submitted orders are excluded; self-approval is not allowed.</p>}
  </section>;
  return <section><h2>Approval queue</h2>{pending.map(order => <article key={order.id} className="approval-card">
    <h3>{order.orderNumber} · ${(order.totalCents / 100).toFixed(2)}</h3>
    <ul>{order.items.map(item => <li key={item.id}>{item.quantity} × {item.productName} · ${(item.lineTotalCents / 100).toFixed(2)}</li>)}</ul>
    <button onClick={() => onApprove(order.id)}>Approve</button><button className="secondary" onClick={() => onReject(order.id)}>Reject</button>
  </article>)}{selfSubmitted && <p role="status">Your own submitted orders are excluded; self-approval is not allowed.</p>}</section>;
}
