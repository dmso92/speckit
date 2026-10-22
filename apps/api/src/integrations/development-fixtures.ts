import type { Actor, CatalogPort } from "@purchase-orders/library";
import type { ActorResolver } from "../http/middleware/authentication.js";

export const developmentActors: Record<string, Actor> = {
  "dev-buyer": { id: "dev-buyer", roles: ["buyer"], branchIds: ["branch-demo"], supplierIds: [] },
  "dev-approver": { id: "dev-approver", roles: ["approver"], branchIds: [], supplierIds: [] },
  "dev-fulfiller": { id: "dev-fulfiller", roles: ["fulfiller"], branchIds: [], supplierIds: [] },
  "dev-supplier": { id: "dev-supplier", roles: ["supplier"], branchIds: [], supplierIds: ["supplier-demo"] }
};

export const developmentFixtureActorResolver: ActorResolver = async authorization => {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return token ? developmentActors[token] ?? null : null;
};

/**
 * These IDs and contact details are synthetic. Never enable this adapter outside local development.
 */
export const developmentFixtureCatalog: CatalogPort = {
  async validateReference(kind, id) {
    if (kind === "branch" && id === "branch-demo") return { id, name: "Development fixture branch" };
    if (kind === "supplier" && id === "supplier-demo") return { id, name: "Development fixture supplier" };
    return null;
  },
  async getProduct(id) {
    if (!id.startsWith("demo-") && !id.startsWith("widget-") && id !== "widget") return null;
    return { id, name: `Development fixture ${id}`, sku: `DEV-${id}` };
  },
  async getSupplierContact(id) {
    return id === "supplier-demo" ? { email: "supplier@example.test" } : null;
  }
};
