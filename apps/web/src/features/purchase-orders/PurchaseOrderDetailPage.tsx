import { useEffect, useState } from "react";
import type { FulfillmentShipment, PurchaseOrder, ShipmentLineInput } from "./api.js";
import { formatMoney } from "./api.js";

export function PurchaseOrderDetailPage({ order, actorKind, history, onSubmit, onEdit, onFulfill, onCancel }: {
  order: PurchaseOrder;
  actorKind: "buyer" | "fulfiller";
  history: FulfillmentShipment[];
  onSubmit: () => void;
  onEdit: () => void;
  onFulfill: (items: ShipmentLineInput[]) => void;
  onCancel: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [shipmentError, setShipmentError] = useState("");
  useEffect(() => {
    setQuantities(Object.fromEntries(order.items.map(item => [item.id, "0"])));
    setShipmentError("");
  }, [order.id, order.items]);
  const canReceive = actorKind === "fulfiller" &&
    (order.status === "Approved" || order.status === "Partially Fulfilled" ||
      (order.status === "Submitted" && order.totalCents <= 1_000_000));
  function recordShipment() {
    const items = order.items.flatMap(item => {
      const quantity = Number(quantities[item.id] ?? 0);
      return quantity > 0 ? [{ purchaseOrderLineItemId: item.id, quantity }] : [];
    });
    if (items.length === 0 || items.some(item => !Number.isSafeInteger(item.quantity))) {
      setShipmentError("Enter a positive whole-unit quantity for at least one line.");
      return;
    }
    setShipmentError("");
    onFulfill(items);
  }

  return <section aria-labelledby="order-detail-heading" className="order-detail">
    <h2 id="order-detail-heading">{order.orderNumber}</h2>
    <p><strong>Status:</strong> <span>{order.status}</span></p>
    {order.approvalDecision && <p><strong>Decision:</strong> {order.approvalDecision.decision} by {order.approvalDecision.approverId} at {new Date(order.approvalDecision.decidedAt).toLocaleString()}
      {order.approvalDecision.reason ? ` — ${order.approvalDecision.reason}` : ""}
    </p>}
    <p><strong>Branch:</strong> {order.branchId ?? "Not selected"} · <strong>Supplier:</strong> {order.supplierId ?? "Not selected"}</p>
    <table>
      <thead><tr><th scope="col">Product</th><th scope="col">Ordered</th><th scope="col">Received</th><th scope="col">Remaining</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
      <tbody>{order.items.map(item => <tr key={item.id ?? item.productId}>
        <td>{item.productName}</td><td>{item.quantity}</td><td>{item.receivedQuantity}</td><td>{item.remainingQuantity}</td>
        <td>{formatMoney(item.unitPriceCents)}</td><td>{formatMoney(item.lineTotalCents)}</td>
      </tr>)}</tbody>
    </table>
    {canReceive && <fieldset className="shipment-entry">
      <legend>Record a shipment</legend>
      {order.items.filter(item => item.remainingQuantity > 0).map(item => <label key={item.id}>
        Received quantity for {item.productId}
        <input aria-label={`Received quantity for ${item.productId}`} type="number" min="0" step="1"
          max={item.remainingQuantity} value={quantities[item.id] ?? "0"}
          onChange={event => setQuantities(current => ({ ...current, [item.id]: event.target.value }))} />
      </label>)}
      {shipmentError && <p role="alert" className="error-message">{shipmentError}</p>}
      <button onClick={recordShipment}>Record shipment</button>
    </fieldset>}
    {order.status === "Cancelled" && order.items.some(item => item.remainingQuantity > 0) &&
      <p className="cancelled-remainder">Unreceived remainder cancelled: {order.items.reduce((total, item) => total + item.remainingQuantity, 0)} units.</p>}
    <section aria-labelledby="fulfillment-history-heading" className="fulfillment-history">
      <h3 id="fulfillment-history-heading">Fulfillment history</h3>
      {history.length === 0 ? <p className="empty-state">No shipments recorded.</p> :
        <ol aria-label="Fulfillment history">
          {history.map(shipment => <li key={shipment.id}>
            <time dateTime={shipment.recordedAt}>{new Date(shipment.recordedAt).toLocaleString()}</time>
            {" — "}Recorded by {shipment.recordedBy}
            <ul>{shipment.items.map(line => {
              const item = order.items.find(candidate => candidate.id === line.purchaseOrderLineItemId);
              return <li key={line.purchaseOrderLineItemId}>{item?.productName ?? line.purchaseOrderLineItemId}: {line.quantity}</li>;
            })}</ul>
          </li>)}
        </ol>}
    </section>
    <p className="total">Total: {formatMoney(order.totalCents)}</p>
    <div className="actions">
      {actorKind === "buyer" && order.status === "Draft" && <button onClick={onSubmit}>Submit order</button>}
      {actorKind === "buyer" && order.status === "Draft" && <button className="secondary" onClick={onEdit}>Save draft changes</button>}
      {actorKind === "buyer" && order.status === "Draft" && <button className="secondary" onClick={onCancel}>Cancel order</button>}
      {actorKind === "buyer" && ["Submitted", "Approved", "Partially Fulfilled"].includes(order.status) && <button className="secondary" onClick={onCancel}>Cancel order</button>}
    </div>
  </section>;
}
