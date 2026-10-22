import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { openDatabase, PurchaseOrderRepository } from "@purchase-orders/library";
import { developmentCatalog } from "../../../../packages/purchase-orders/tests/support/test-catalog.js";
import type { Actor } from "@purchase-orders/library";
import type { AppDependencies } from "../../src/app.js";

const actors: Record<string, Actor> = {
  "buyer-test": { id: "buyer-test", roles: ["buyer"], branchIds: ["branch-demo"], supplierIds: [] },
  "approver-test": { id: "approver-test", roles: ["approver"], branchIds: [], supplierIds: [] },
  "fulfiller-test": { id: "fulfiller-test", roles: ["fulfiller"], branchIds: [], supplierIds: [] },
  "supplier-test": { id: "supplier-user", roles: ["supplier"], branchIds: [], supplierIds: ["supplier-demo"] },
  "other-supplier-test": { id: "other-supplier-user", roles: ["supplier"], branchIds: [], supplierIds: ["supplier-other"] }
};

export function createTestApplication(): { dependencies: AppDependencies; cleanup: () => void } {
  const path = join(tmpdir(), `purchase-order-api-${randomUUID()}.sqlite`);
  const db = openDatabase(path);
  const repository = new PurchaseOrderRepository(db);
  return {
    dependencies: {
      repository,
      catalog: developmentCatalog,
      resolveActor: async (authorization) => actors[authorization?.replace(/^Bearer\s+/i, "") ?? ""] ?? null
    },
    cleanup: () => { db.close(); for (const suffix of ["", "-shm", "-wal"]) rmSync(`${path}${suffix}`, { force: true }); }
  };
}
