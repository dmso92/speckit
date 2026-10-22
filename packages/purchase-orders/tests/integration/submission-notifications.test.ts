import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, openDatabase } from "../../src/sqlite/connection.js";
import { PurchaseOrderRepository } from "../../src/sqlite/purchase-order-repository.js";
import { createTempDatabasePath, removeTempDatabase } from "../support/sqlite-test-database.js";

describe("SQLite submission transaction", () => {
  const paths: string[] = [];
  afterEach(() => { for (const path of paths.splice(0)) removeTempDatabase(path); });
  it("atomically persists submitted status, supplier inbox, and one email outbox record", () => {
    const path = createTempDatabasePath(); paths.push(path);
    const db = openDatabase(path);
    const repo = new PurchaseOrderRepository(db);
    const order = repo.createDraft({ branchId: "b", supplierId: "s", createdBy: "buyer", items: [{ productId: "p", productNameSnapshot: "Part", skuSnapshot: null, quantity: 2, unitPriceCents: 100 }] });
    repo.submit(order.id, { recipient: "supplier@example.test" });
    repo.submit(order.id, { recipient: "supplier@example.test" });
    expect(repo.get(order.id)?.status).toBe("Submitted");
    expect(repo.listSupplierNotifications("s")).toHaveLength(1);
    expect(repo.listSupplierNotifications("other-supplier")).toHaveLength(0);
    expect(repo.listEmailOutbox()).toHaveLength(1);
    const notification = repo.listSupplierNotifications("s")[0]!;
    expect(repo.markSupplierNotificationRead(notification.id, "other-supplier")).toBe(false);
    expect(repo.markSupplierNotificationRead(notification.id, "s")).toBe(true);
    const email = repo.listEmailOutbox()[0]!;
    repo.recordEmailAttempt(email.id, { sent: false, error: "Email transport failed; retry is available." });
    expect(repo.listEmailOutbox("Failed")).toHaveLength(1);
    closeDatabase(db);
  });

  it("rolls back the status and portal row if the outbox insert fails", () => {
    const path = createTempDatabasePath(); paths.push(path);
    const db = openDatabase(path);
    const repo = new PurchaseOrderRepository(db);
    const order = repo.createDraft({ branchId: "b", supplierId: "s", createdBy: "buyer", items: [{ productId: "p", productNameSnapshot: "Part", skuSnapshot: null, quantity: 1, unitPriceCents: 100 }] });
    db.exec(`CREATE TRIGGER fail_outbox_insert BEFORE INSERT ON email_outbox_deliveries
      BEGIN SELECT RAISE(ABORT, 'simulated insert failure'); END;`);
    expect(() => repo.submit(order.id, { recipient: "supplier@example.test" })).toThrow();
    expect(repo.get(order.id)?.status).toBe("Draft");
    expect(repo.listSupplierNotifications("s")).toHaveLength(0);
    expect(repo.listEmailOutbox()).toHaveLength(0);
    closeDatabase(db);
  });
});
