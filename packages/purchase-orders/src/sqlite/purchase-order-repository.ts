import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { calculateTotals, DomainError, validateDraftInput, type ApprovalValue, type DraftInput, type DraftUpdate, type PurchaseOrder, type PurchaseOrderLine, type PurchaseOrderStatus } from "../domain/purchase-order.js";
import { transitionOrder } from "../domain/lifecycle.js";
import { deriveFulfillmentStatus, remainingQuantity, validateShipment, type FulfillmentShipment, type ShipmentLineInput } from "../domain/fulfillment.js";
import { buildSubmissionNotification } from "../application/submit-purchase-order.js";

type OrderRow = {
  id: string; order_number: string; branch_id: string | null; supplier_id: string | null; created_by: string;
  status: PurchaseOrderStatus; currency: "USD"; created_at: string; updated_at: string; submitted_at: string | null;
  fulfilled_at: string | null; cancelled_at: string | null; version: number; total_cents: number;
};

type ItemRow = {
  id: string; product_id: string; product_name_snapshot: string; sku_snapshot: string | null;
  quantity: number; unit_price_cents: number; line_total_cents: number; received_quantity: number;
};

export interface SupplierNotificationRecord {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  payload: ReturnType<typeof buildSubmissionNotification>;
  createdAt: string;
  readAt: string | null;
}

export interface EmailOutboxRecord {
  id: string;
  purchaseOrderId: string;
  recipient: string;
  payload: ReturnType<typeof buildSubmissionNotification>;
  state: "Pending" | "Sent" | "Failed";
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  lastError: string | null;
}

export class PurchaseOrderRepository {
  constructor(private readonly db: Database.Database) {}

  createDraft(input: DraftInput): PurchaseOrder {
    validateDraftInput({ items: input.items, branchId: input.branchId, supplierId: input.supplierId });
    const now = new Date().toISOString();
    const id = randomUUID();
    const orderNumber = `PO-${now.slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const calculated = calculateTotals(input.items);
    const insert = this.db.transaction(() => {
      this.db.prepare(`INSERT INTO purchase_orders
        (id, order_number, branch_id, supplier_id, created_by, status, currency, created_at, updated_at, version, total_cents)
        VALUES (?, ?, ?, ?, ?, 'Draft', 'USD', ?, ?, 1, ?)`)
        .run(id, orderNumber, input.branchId, input.supplierId, input.createdBy, now, now, calculated.totalCents);
      this.insertItems(id, calculated.items);
    });
    insert();
    return this.get(id)!;
  }

  get(id: string): PurchaseOrder | null {
    const row = this.db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id) as OrderRow | undefined;
    return row ? this.mapOrder(row) : null;
  }

  list(options: { status?: PurchaseOrderStatus; branchId?: string; supplierId?: string; createdBy?: string; page?: number; pageSize?: number } = {}): { items: PurchaseOrder[]; page: number; pageSize: number; total: number } {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
    const clauses: string[] = [];
    const values: (string | number)[] = [];
    if (options.status) { clauses.push("status = ?"); values.push(options.status); }
    if (options.branchId) { clauses.push("branch_id = ?"); values.push(options.branchId); }
    if (options.supplierId) { clauses.push("supplier_id = ?"); values.push(options.supplierId); }
    if (options.createdBy) { clauses.push("created_by = ?"); values.push(options.createdBy); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = (this.db.prepare(`SELECT COUNT(*) AS count FROM purchase_orders ${where}`).get(...values) as { count: number }).count;
    const rows = this.db.prepare(`SELECT * FROM purchase_orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...values, pageSize, (page - 1) * pageSize) as OrderRow[];
    return { items: rows.map(row => this.mapOrder(row)), page, pageSize, total };
  }

  updateDraft(id: string, input: DraftUpdate): PurchaseOrder {
    const update = this.db.transaction(() => {
      const current = this.get(id);
      if (!current) throw new DomainError("Purchase order was not found.", "not_found");
      if (current.status !== "Draft") throw new DomainError("Only Draft orders can be edited.", "conflict");
      const branchId = input.branchId === undefined ? current.branchId : input.branchId;
      const supplierId = input.supplierId === undefined ? current.supplierId : input.supplierId;
      const items = input.items === undefined ? current.items : input.items;
      validateDraftInput({ items, branchId, supplierId });
      const calculated = calculateTotals(items);
      const now = new Date().toISOString();
      this.db.prepare("UPDATE purchase_orders SET branch_id = ?, supplier_id = ?, updated_at = ?, version = version + 1, total_cents = ? WHERE id = ?")
        .run(branchId, supplierId, now, calculated.totalCents, id);
      if (input.items !== undefined) {
        this.db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?").run(id);
        this.insertItems(id, calculated.items);
      }
    });
    update();
    return this.get(id)!;
  }

  submit(id: string, options: { recipient: string; expectedVersion?: number }): PurchaseOrder {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.recipient)) throw new DomainError("Supplier catalog returned an invalid email address.");
    const submit = this.db.transaction(() => {
      const current = this.get(id);
      if (!current) throw new DomainError("Purchase order was not found.", "not_found");
      if (current.status === "Submitted" || current.status === "Approved" || current.status === "Fulfilled") return;
      if (current.status !== "Draft") throw new DomainError("Only a Draft order can be submitted.", "conflict");
      if (options.expectedVersion !== undefined && current.version !== options.expectedVersion) throw new DomainError("Draft changed while it was being submitted; reload and try again.", "conflict");
      validateDraftInput({ items: current.items, branchId: current.branchId, supplierId: current.supplierId, requireComplete: true });
      const snapshot = buildSubmissionNotification(current);
      const now = new Date().toISOString();
      this.db.prepare("UPDATE purchase_orders SET status = 'Submitted', submitted_at = ?, updated_at = ?, version = version + 1 WHERE id = ?")
        .run(now, now, id);
      this.db.prepare(`INSERT INTO supplier_portal_notifications
        (id, purchase_order_id, supplier_id, event_type, payload, created_at)
        VALUES (?, ?, ?, 'purchase_order_submitted', ?, ?)`)
        .run(randomUUID(), id, current.supplierId, JSON.stringify(snapshot), now);
      this.db.prepare(`INSERT INTO email_outbox_deliveries
        (id, purchase_order_id, channel, recipient, payload, state, attempt_count, created_at, updated_at)
        VALUES (?, ?, 'email', ?, ?, 'Pending', 0, ?, ?)`)
        .run(randomUUID(), id, options.recipient, JSON.stringify(snapshot), now, now);
    });
    submit();
    return this.get(id)!;
  }

  decide(id: string, actorId: string, designatedApprover: boolean, decision: ApprovalValue, reason: string | null = null): PurchaseOrder {
    const operation = this.db.transaction(() => {
      const current = this.require(id);
      const next = transitionOrder(current, { type: decision === "Approved" ? "approve" : "reject", actorId, isDesignatedApprover: designatedApprover, reason });
      this.db.prepare(`INSERT INTO approval_decisions (id, purchase_order_id, approver_id, decision, reason, decided_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(randomUUID(), id, actorId, decision, reason, next.approvalDecision!.decidedAt);
      this.persistTransition(next);
    });
    operation();
    return this.get(id)!;
  }

  recordShipment(id: string, actorId: string, items: ShipmentLineInput[]): PurchaseOrder {
    const operation = this.db.transaction(() => {
      const current = this.require(id);
      validateShipment(current, items);
      const shipmentId = randomUUID();
      const recordedAt = new Date().toISOString();
      this.db.prepare(`INSERT INTO fulfillment_shipments (id, purchase_order_id, recorded_by, recorded_at)
        VALUES (?, ?, ?, ?)`).run(shipmentId, id, actorId, recordedAt);
      const insertLine = this.db.prepare(`INSERT INTO fulfillment_shipment_lines
        (shipment_id, purchase_order_line_item_id, quantity) VALUES (?, ?, ?)`);
      const updateReceived = this.db.prepare(`UPDATE purchase_order_items
        SET received_quantity = received_quantity + ? WHERE id = ? AND purchase_order_id = ?`);
      for (const item of items) {
        insertLine.run(shipmentId, item.purchaseOrderLineItemId, item.quantity);
        const changed = updateReceived.run(item.quantity, item.purchaseOrderLineItemId, id).changes;
        if (changed !== 1) throw new DomainError("Shipment references an unknown purchase-order line item.", "validation");
      }
      const refreshed = this.require(id);
      const status = deriveFulfillmentStatus(refreshed.items);
      const now = new Date().toISOString();
      this.db.prepare(`UPDATE purchase_orders
        SET status = ?, fulfilled_at = ?, updated_at = ?, version = version + 1 WHERE id = ?`)
        .run(status, status === "Fulfilled" ? now : null, now, id);
    });
    operation();
    return this.get(id)!;
  }

  getFulfillmentHistory(id: string): FulfillmentShipment[] {
    const headers = this.db.prepare(`SELECT id, purchase_order_id, recorded_by, recorded_at
      FROM fulfillment_shipments WHERE purchase_order_id = ? ORDER BY recorded_at ASC, rowid ASC`)
      .all(id) as Array<{ id: string; purchase_order_id: string; recorded_by: string; recorded_at: string }>;
    const getLines = this.db.prepare(`SELECT purchase_order_line_item_id, quantity
      FROM fulfillment_shipment_lines WHERE shipment_id = ? ORDER BY rowid ASC`);
    return headers.map(header => ({
      id: header.id,
      purchaseOrderId: header.purchase_order_id,
      recordedAt: header.recorded_at,
      recordedBy: header.recorded_by,
      items: getLines.all(header.id).map(line => {
        const row = line as { purchase_order_line_item_id: string; quantity: number };
        return { purchaseOrderLineItemId: row.purchase_order_line_item_id, quantity: row.quantity };
      })
    }));
  }

  cancel(id: string): PurchaseOrder {
    return this.mutate(id, order => transitionOrder(order, { type: "cancel", actorId: order.createdBy, isDesignatedApprover: false }));
  }

  listSupplierNotifications(supplierId: string, unreadOnly = false): SupplierNotificationRecord[] {
    const where = unreadOnly ? "AND read_at IS NULL" : "";
    const rows = this.db.prepare(`SELECT * FROM supplier_portal_notifications WHERE supplier_id = ? ${where} ORDER BY created_at DESC`).all(supplierId) as Array<{
      id: string; purchase_order_id: string; supplier_id: string; payload: string; created_at: string; read_at: string | null
    }>;
    return rows.map(row => ({ id: row.id, purchaseOrderId: row.purchase_order_id, supplierId: row.supplier_id, payload: JSON.parse(row.payload) as ReturnType<typeof buildSubmissionNotification>, createdAt: row.created_at, readAt: row.read_at }));
  }

  markSupplierNotificationRead(notificationId: string, supplierId: string): boolean {
    const result = this.db.prepare("UPDATE supplier_portal_notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND supplier_id = ?")
      .run(new Date().toISOString(), notificationId, supplierId);
    return result.changes > 0;
  }

  listEmailOutbox(state?: "Pending" | "Failed"): EmailOutboxRecord[] {
    const rows = this.db.prepare(`SELECT * FROM email_outbox_deliveries ${state ? "WHERE state = ?" : ""} ORDER BY created_at`)
      .all(...(state ? [state] : [])) as Array<{ id: string; purchase_order_id: string; recipient: string; payload: string; state: EmailOutboxRecord["state"]; attempt_count: number; created_at: string; updated_at: string; sent_at: string | null; last_error: string | null }>;
    return rows.map(row => ({ id: row.id, purchaseOrderId: row.purchase_order_id, recipient: row.recipient, payload: JSON.parse(row.payload) as ReturnType<typeof buildSubmissionNotification>, state: row.state, attemptCount: row.attempt_count, createdAt: row.created_at, updatedAt: row.updated_at, sentAt: row.sent_at, lastError: row.last_error }));
  }

  recordEmailAttempt(id: string, outcome: { sent: boolean; error?: string }): void {
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE email_outbox_deliveries SET
      attempt_count = attempt_count + 1,
      state = ?,
      updated_at = ?,
      sent_at = CASE WHEN ? THEN ? ELSE sent_at END,
      last_error = ?
      WHERE id = ?`)
      .run(outcome.sent ? "Sent" : "Failed", now, outcome.sent ? 1 : 0, now, outcome.sent ? null : (outcome.error ?? "Delivery failed").slice(0, 300), id);
  }

  private mutate(id: string, transition: (order: PurchaseOrder) => PurchaseOrder): PurchaseOrder {
    const operation = this.db.transaction(() => this.persistTransition(transition(this.require(id))));
    operation();
    return this.get(id)!;
  }

  private persistTransition(order: PurchaseOrder): void {
    this.db.prepare(`UPDATE purchase_orders SET status = ?, updated_at = ?, version = ?, fulfilled_at = ?, cancelled_at = ? WHERE id = ?`)
      .run(order.status, order.updatedAt, order.version, order.fulfilledAt, order.cancelledAt, order.id);
  }

  private require(id: string): PurchaseOrder {
    const order = this.get(id);
    if (!order) throw new DomainError("Purchase order was not found.", "not_found");
    return order;
  }

  private insertItems(orderId: string, items: PurchaseOrderLine[]): void {
    const insert = this.db.prepare(`INSERT INTO purchase_order_items
      (id, purchase_order_id, product_id, product_name_snapshot, sku_snapshot, quantity, unit_price_cents, line_total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of items) insert.run(randomUUID(), orderId, item.productId, item.productNameSnapshot, item.skuSnapshot, item.quantity, item.unitPriceCents, item.lineTotalCents);
  }

  private mapOrder(row: OrderRow): PurchaseOrder {
    const itemRows = this.db.prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY rowid").all(row.id) as ItemRow[];
    const decisionRow = this.db.prepare("SELECT approver_id, decision, reason, decided_at FROM approval_decisions WHERE purchase_order_id = ?").get(row.id) as { approver_id: string; decision: ApprovalValue; reason: string | null; decided_at: string } | undefined;
    return {
      id: row.id, orderNumber: row.order_number, branchId: row.branch_id, supplierId: row.supplier_id, createdBy: row.created_by,
      status: row.status, currency: "USD", createdAt: row.created_at, updatedAt: row.updated_at, submittedAt: row.submitted_at,
      fulfilledAt: row.fulfilled_at, cancelledAt: row.cancelled_at, version: row.version, totalCents: row.total_cents,
      items: itemRows.map(item => ({
        id: item.id, productId: item.product_id, productNameSnapshot: item.product_name_snapshot, skuSnapshot: item.sku_snapshot,
        quantity: item.quantity, unitPriceCents: item.unit_price_cents, lineTotalCents: item.line_total_cents,
        receivedQuantity: item.received_quantity, remainingQuantity: remainingQuantity({ quantity: item.quantity, receivedQuantity: item.received_quantity })
      })),
      approvalDecision: decisionRow ? { approverId: decisionRow.approver_id, decision: decisionRow.decision, reason: decisionRow.reason, decidedAt: decisionRow.decided_at } : null
    };
  }
}
