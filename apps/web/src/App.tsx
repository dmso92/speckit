import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useActor } from "./state/ActorContext.js";
import { usePurchaseOrders } from "./state/PurchaseOrderContext.js";
import { ApprovalQueuePage } from "./features/purchase-orders/ApprovalQueuePage.js";
import { PurchaseOrderDetailPage } from "./features/purchase-orders/PurchaseOrderDetailPage.js";
import { PurchaseOrderListPage } from "./features/purchase-orders/PurchaseOrderListPage.js";
import { formatMoney, purchaseOrderApi, type FulfillmentShipment, type PurchaseOrder, type ShipmentLineInput, type SupplierNotification } from "./features/purchase-orders/api.js";
import { SupplierNotificationsPage } from "./features/purchase-orders/SupplierNotificationsPage.js";
import "./features/purchase-orders/purchase-orders.css";

export function App() {
  const actor = useActor();
  const { orders, setOrders } = usePurchaseOrders();
  const [notifications, setNotifications] = useState<SupplierNotification[]>([]);
  const [fulfillmentHistory, setFulfillmentHistory] = useState<FulfillmentShipment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("branch-demo");
  const [supplierId, setSupplierId] = useState("supplier-demo");
  const [lines, setLines] = useState([{ productId: "widget-demo", quantity: "2", unitPriceCents: "1250" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!actor.enabled || !actor.token) return;
    setError("");
    try {
      if (actor.kind === "supplier") {
        const result = await purchaseOrderApi.notifications(actor.token);
        setNotifications(result.items);
      } else {
        const result = await purchaseOrderApi.list(actor.token);
        setOrders(result.items);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load purchase orders.");
    }
  }, [actor.enabled, actor.kind, actor.token]);

  useEffect(() => { void refresh(); }, [refresh]);
  const selected = orders.find(order => order.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    setBranchId(selected.branchId ?? "");
    setSupplierId(selected.supplierId ?? "");
    setLines(selected.items.map(item => ({
      productId: item.productId,
      quantity: String(item.quantity),
      unitPriceCents: String(item.unitPriceCents)
    })));
  }, [selected]);
  useEffect(() => {
    if (!selected || !actor.token || actor.kind === "supplier") {
      setFulfillmentHistory([]);
      return;
    }
    let active = true;
    void purchaseOrderApi.fulfillmentHistory(actor.token, selected.id)
      .then(result => { if (active) setFulfillmentHistory(result.shipments); })
      .catch(() => { if (active) setFulfillmentHistory([]); });
    return () => { active = false; };
  }, [selected?.id, actor.token, actor.kind, orders]);

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try { await action(); await refresh(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "The operation failed."); }
    finally { setBusy(false); }
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor.token) return;
    const parsedLines = lines.map(line => ({ productId: line.productId.trim(), quantity: Number(line.quantity), unitPriceCents: Number(line.unitPriceCents) }));
    if (parsedLines.some(line => !line.productId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0)) { setError("Every product needs a positive whole-number quantity."); return; }
    if (parsedLines.some(line => !Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0)) { setError("Every unit price must be a non-negative whole number of cents."); return; }
    setBusy(true);
    setError("");
    try {
      const order = await purchaseOrderApi.create(actor.token, {
        branchId, supplierId,
        items: parsedLines
      });
      setSelectedId(order.id);
      await refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not create draft."); }
    finally { setBusy(false); }
  }

  async function markRead(id: string) {
    if (!actor.token) return;
    await runAction(async () => { await purchaseOrderApi.markRead(actor.token!, id); });
  }

  return <main className="app-shell">
    <header className="app-header">
      <div><p className="eyebrow">Purchasing workspace</p><h1>Purchase orders</h1></div>
      {actor.enabled && <label className="actor-picker">Development actor
        <select value={actor.kind} onChange={event => actor.selectKind(event.target.value as typeof actor.kind)}>
          <option value="buyer">Buyer</option><option value="approver">Approver</option><option value="fulfiller">Fulfiller</option><option value="supplier">Supplier</option>
        </select>
      </label>}
    </header>
    {actor.enabled && <p className="development-notice" role="status">Development fixtures enabled — synthetic identities, catalog values, and email capture only.</p>}
    {!actor.enabled && <section className="integration-notice" role="status">
      <h2>Host integrations are required</h2>
      <p>No identity or catalog provider is configured. The API fails closed until host adapters are connected. Development fixtures are disabled.</p>
    </section>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {busy && <p role="status">Working…</p>}
    {actor.enabled && actor.kind === "supplier" ? <SupplierNotificationsPage notifications={notifications} onRead={id => void markRead(id)} /> :
      actor.enabled && actor.kind === "approver" ? <ApprovalQueuePage orders={orders} actorId={actor.token ?? ""} onApprove={id => actor.token && void runAction(() => purchaseOrderApi.decide(actor.token!, id, "Approved"))} onReject={id => actor.token && void runAction(() => purchaseOrderApi.decide(actor.token!, id, "Rejected"))} /> :
      actor.enabled ? <div className="workspace-grid">
        <section className="panel">
          <h2>Create draft</h2>
          <form onSubmit={createDraft} className="draft-form">
            <label>Branch identifier<input aria-label="Branch identifier" value={branchId} onChange={event => setBranchId(event.target.value)} required /></label>
            <label>Supplier identifier<input aria-label="Supplier identifier" value={supplierId} onChange={event => setSupplierId(event.target.value)} required /></label>
            {lines.map((line, index) => <fieldset className="line-editor" key={index}>
              <legend>Line item {index + 1}</legend>
              <label>Product identifier<input aria-label="Product identifier" value={line.productId} onChange={event => setLines(current => current.map((entry, i) => i === index ? { ...entry, productId: event.target.value } : entry))} required /></label>
              <div className="inline-fields">
                <label>Quantity<input aria-label="Quantity" type="number" min="1" step="1" value={line.quantity} onChange={event => setLines(current => current.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))} required /></label>
                <label>Unit price (cents)<input aria-label="Unit price (cents)" type="number" min="0" step="1" value={line.unitPriceCents} onChange={event => setLines(current => current.map((entry, i) => i === index ? { ...entry, unitPriceCents: event.target.value } : entry))} required /></label>
              </div>
              {lines.length > 1 && <button className="secondary" type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Remove line {index + 1}</button>}
            </fieldset>)}
            <button className="secondary" type="button" onClick={() => setLines(current => [...current, { productId: "", quantity: "1", unitPriceCents: "0" }])}>Add line item</button>
            <p className="preview-total">Preview: {formatMoney(lines.reduce((total, line) => total + Number(line.quantity) * Number(line.unitPriceCents), 0))}</p>
            <button disabled={busy || actor.kind !== "buyer"} type="submit">Create draft</button>
          </form>
          <h2>Orders</h2>
          <PurchaseOrderListPage orders={orders} selectedId={selectedId} onSelect={setSelectedId} />
        </section>
        <section className="panel">
          <h2>Order review</h2>
          {selected ? <PurchaseOrderDetailPage order={selected} actorKind={actor.kind === "fulfiller" ? "fulfiller" : "buyer"} history={fulfillmentHistory}
            onSubmit={() => actor.token && void runAction(() => purchaseOrderApi.submit(actor.token!, selected.id))}
            onEdit={() => actor.token && void runAction(() => purchaseOrderApi.update(actor.token!, selected.id, {
              branchId, supplierId, items: lines.map(line => ({ productId: line.productId, quantity: Number(line.quantity), unitPriceCents: Number(line.unitPriceCents) }))
            }))}
            onFulfill={(items: ShipmentLineInput[]) => actor.token && void runAction(() => purchaseOrderApi.fulfill(actor.token!, selected.id, items))}
            onCancel={() => actor.token && void runAction(() => purchaseOrderApi.cancel(actor.token!, selected.id))}
          /> : <p className="empty-state">Select an order to review its details.</p>}
        </section>
      </div> : null}
  </main>;
}
