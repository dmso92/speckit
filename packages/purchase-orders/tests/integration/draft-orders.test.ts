import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, openDatabase } from "../../src/sqlite/connection.js";
import { PurchaseOrderRepository } from "../../src/sqlite/purchase-order-repository.js";
import { createTempDatabasePath, removeTempDatabase } from "../support/sqlite-test-database.js";

const paths: string[] = [];
afterEach(() => { for (const path of paths.splice(0)) removeTempDatabase(path); });

describe("SQLite draft persistence", () => {
  it("persists a multi-line order and recalculates totals on edit", () => {
    const path = createTempDatabasePath(); paths.push(path);
    const db = openDatabase(path);
    const repository = new PurchaseOrderRepository(db);
    const created = repository.createDraft({ branchId: "branch-demo", supplierId: "supplier-demo", createdBy: "buyer-demo", items: [
      { productId: "widget-a", productNameSnapshot: "Widget A", skuSnapshot: "A", quantity: 2, unitPriceCents: 1250 },
      { productId: "widget-b", productNameSnapshot: "Widget B", skuSnapshot: null, quantity: 1, unitPriceCents: 4000 }
    ] });
    expect(created.totalCents).toBe(6500);
    const reopenedDb = openDatabase(path);
    const reopened = new PurchaseOrderRepository(reopenedDb).get(created.id);
    expect(reopened?.items).toHaveLength(2);
    closeDatabase(reopenedDb);
    const updated = repository.updateDraft(created.id, { supplierId: "supplier-demo", items: [{ productId: "widget-a", productNameSnapshot: "Widget A", skuSnapshot: "A", quantity: 3, unitPriceCents: 1250 }] });
    expect(updated.totalCents).toBe(3750);
    closeDatabase(db);
  });
});
