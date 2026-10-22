import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { closeDatabase, openDatabase } from "../../src/sqlite/connection.js";
import { migrateDatabase } from "../../src/sqlite/migrate.js";
import { PurchaseOrderRepository } from "../../src/sqlite/purchase-order-repository.js";
import { createTempDatabasePath, removeTempDatabase } from "../support/sqlite-test-database.js";

describe("SQLite partial fulfillment", () => {
  const paths: string[] = [];
  afterEach(() => { for (const path of paths.splice(0)) removeTempDatabase(path); });

  it("persists multiple immutable shipments, cumulative quantities, and chronological history", () => {
    const path = createTempDatabasePath(); paths.push(path);
    const db = openDatabase(path);
    try {
      const repo = new PurchaseOrderRepository(db);
      const draft = repo.createDraft({ branchId: "b", supplierId: "s", createdBy: "buyer", items: [
        { productId: "p1", productNameSnapshot: "Part 1", quantity: 3, unitPriceCents: 10 },
        { productId: "p2", productNameSnapshot: "Part 2", quantity: 2, unitPriceCents: 20 }
      ] });
      const submitted = repo.submit(draft.id, { recipient: "supplier@example.test" });
      const firstLine = submitted.items[0]!;
      const secondLine = submitted.items[1]!;
      expect(repo.recordShipment(draft.id, "receiver-a", [{ purchaseOrderLineItemId: firstLine.id!, quantity: 1 }]).status).toBe("Partially Fulfilled");
      expect(repo.recordShipment(draft.id, "receiver-b", [
        { purchaseOrderLineItemId: firstLine.id!, quantity: 2 },
        { purchaseOrderLineItemId: secondLine.id!, quantity: 2 }
      ]).status).toBe("Fulfilled");
      const history = repo.getFulfillmentHistory(draft.id);
      expect(history).toHaveLength(2);
      expect(new Date(history[0]!.recordedAt).getTime()).toBeLessThanOrEqual(new Date(history[1]!.recordedAt).getTime());
      expect(history.map(shipment => shipment.recordedBy)).toEqual(["receiver-a", "receiver-b"]);
      expect(history[0]?.items).toEqual([{ purchaseOrderLineItemId: firstLine.id, quantity: 1 }]);
      expect(repo.get(draft.id)?.items.map(item => item.receivedQuantity)).toEqual([3, 2]);
      expect(() => db.prepare("UPDATE fulfillment_shipments SET recorded_by = 'changed' WHERE id = ?").run(history[0]!.id)).toThrow(/immutable/i);
      expect(() => db.prepare("DELETE FROM fulfillment_shipment_lines WHERE shipment_id = ?").run(history[0]!.id)).toThrow(/immutable/i);
    } finally { closeDatabase(db); }
  });

  it("rolls back every shipment row and quantity when any line exceeds its remaining quantity", () => {
    const path = createTempDatabasePath(); paths.push(path);
    const db = openDatabase(path);
    try {
      const repo = new PurchaseOrderRepository(db);
      const draft = repo.createDraft({ branchId: "b", supplierId: "s", createdBy: "buyer", items: [
        { productId: "p1", quantity: 2, unitPriceCents: 10 }, { productId: "p2", quantity: 1, unitPriceCents: 20 }
      ] });
      const submitted = repo.submit(draft.id, { recipient: "supplier@example.test" });
      const [first, second] = submitted.items;
      expect(() => repo.recordShipment(draft.id, "receiver", [
        { purchaseOrderLineItemId: first!.id!, quantity: 1 },
        { purchaseOrderLineItemId: second!.id!, quantity: 2 }
      ])).toThrow(/exceed/i);
      expect(repo.getFulfillmentHistory(draft.id)).toEqual([]);
      expect(repo.get(draft.id)?.status).toBe("Submitted");
      expect(repo.get(draft.id)?.items.map(item => item.receivedQuantity)).toEqual([0, 0]);
    } finally { closeDatabase(db); }
  });

  it("returns empty history and preserves receipts when partially fulfilled remainder is cancelled", () => {
    const path = createTempDatabasePath(); paths.push(path);
    const db = openDatabase(path);
    try {
      const repo = new PurchaseOrderRepository(db);
      const draft = repo.createDraft({ branchId: "b", supplierId: "s", createdBy: "buyer", items: [{ productId: "p", quantity: 4, unitPriceCents: 5 }] });
      const submitted = repo.submit(draft.id, { recipient: "supplier@example.test" });
      const line = submitted.items[0]!;
      expect(repo.getFulfillmentHistory(draft.id)).toEqual([]);
      repo.recordShipment(draft.id, "receiver", [{ purchaseOrderLineItemId: line.id!, quantity: 1 }]);
      const beforeCancel = repo.getFulfillmentHistory(draft.id);
      const cancelled = repo.cancel(draft.id);
      expect(cancelled.status).toBe("Cancelled");
      expect(cancelled.items[0]?.receivedQuantity).toBe(1);
      expect(cancelled.items[0]?.remainingQuantity).toBe(3);
      expect(repo.getFulfillmentHistory(draft.id)).toEqual(beforeCancel);
      expect(() => repo.recordShipment(draft.id, "receiver", [{ purchaseOrderLineItemId: line.id!, quantity: 1 }])).toThrow();
    } finally { closeDatabase(db); }
  });

  it("upgrades existing orders, line items, and approval decisions without breaking foreign keys", () => {
    const path = createTempDatabasePath(); paths.push(path);
    const db = new Database(path);
    db.pragma("foreign_keys = ON");
    try {
      db.exec("CREATE TABLE schema_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
      for (const name of ["001_purchase_orders.sql", "002_submission_notifications.sql", "003_approval_decisions.sql"]) {
        const migrationPath = resolve(process.cwd(), "packages/purchase-orders/src/sqlite/migrations", name);
        db.exec(readFileSync(migrationPath, "utf8"));
        db.prepare("INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)").run(name, "test");
      }
      db.prepare(`INSERT INTO purchase_orders
        (id, order_number, branch_id, supplier_id, created_by, status, currency, created_at, updated_at, submitted_at, version, total_cents)
        VALUES ('po-existing', 'PO-EXISTING', 'branch', 'supplier', 'buyer', 'Submitted', 'USD', 'test', 'test', 'test', 2, 1000001)`).run();
      db.prepare(`INSERT INTO purchase_order_items
        (id, purchase_order_id, product_id, product_name_snapshot, quantity, unit_price_cents, line_total_cents)
        VALUES ('line-existing', 'po-existing', 'product', 'Existing product', 1, 1000001, 1000001)`).run();
      db.prepare(`INSERT INTO approval_decisions
        (id, purchase_order_id, approver_id, decision, decided_at)
        VALUES ('decision-existing', 'po-existing', 'approver', 'Approved', 'test')`).run();

      migrateDatabase(db);

      expect(db.prepare("SELECT id, status FROM purchase_orders WHERE id = 'po-existing'").get())
        .toEqual({ id: "po-existing", status: "Submitted" });
      expect(db.prepare("SELECT id, received_quantity FROM purchase_order_items WHERE id = 'line-existing'").get())
        .toEqual({ id: "line-existing", received_quantity: 0 });
      expect(db.prepare("SELECT id FROM approval_decisions WHERE id = 'decision-existing'").get())
        .toEqual({ id: "decision-existing" });
      expect(db.pragma("foreign_key_check")).toEqual([]);
      expect(db.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
    } finally { db.close(); }
  });
});
