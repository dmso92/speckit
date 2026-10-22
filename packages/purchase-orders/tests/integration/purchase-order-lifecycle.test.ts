import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, openDatabase } from "../../src/sqlite/connection.js";
import { PurchaseOrderRepository } from "../../src/sqlite/purchase-order-repository.js";
import { createTempDatabasePath, removeTempDatabase } from "../support/sqlite-test-database.js";

describe("SQLite purchase-order lifecycle", () => {
  const paths: string[] = [];
  afterEach(() => { for (const path of paths.splice(0)) removeTempDatabase(path); });
  it("records final approval and enforces fulfillment/cancellation transitions", () => {
    const path = createTempDatabasePath(); paths.push(path);
    const db = openDatabase(path);
    const repo = new PurchaseOrderRepository(db);
    const order = repo.createDraft({ branchId: "b", supplierId: "s", createdBy: "buyer", items: [{ productId: "p", productNameSnapshot: "Part", skuSnapshot: null, quantity: 1, unitPriceCents: 1_000_001 }] });
    repo.submit(order.id, { recipient: "supplier@example.test" });
    expect(() => repo.fulfill(order.id)).toThrow();
    repo.decide(order.id, "approver", true, "Approved");
    expect(repo.fulfill(order.id).status).toBe("Fulfilled");
    expect(() => repo.cancel(order.id)).toThrow();
    const rejected = repo.createDraft({ branchId: "b", supplierId: "s", createdBy: "buyer-2", items: [{ productId: "p", productNameSnapshot: "Part", skuSnapshot: null, quantity: 1, unitPriceCents: 1_000_001 }] });
    repo.submit(rejected.id, { recipient: "supplier@example.test" });
    repo.decide(rejected.id, "approver", true, "Rejected");
    expect(repo.get(rejected.id)?.status).toBe("Submitted");
    expect(() => repo.fulfill(rejected.id)).toThrow();
    expect(repo.cancel(rejected.id).status).toBe("Cancelled");
    expect(() => repo.cancel(rejected.id)).toThrow();
    closeDatabase(db);
  });
});
