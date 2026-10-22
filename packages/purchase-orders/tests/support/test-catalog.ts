import type { CatalogPort, CatalogProduct, CatalogReference } from "../../src/ports/catalog.js";

export const developmentCatalog: CatalogPort = {
  async validateReference(kind: "branch" | "supplier", id: string): Promise<CatalogReference | null> {
    if ((kind === "branch" && id === "branch-demo") || (kind === "supplier" && id === "supplier-demo")) return { id, name: `${kind} fixture` };
    return null;
  },
  async getProduct(id: string): Promise<CatalogProduct | null> {
    return id ? { id, name: `Development fixture product ${id}`, sku: `DEV-${id}` } : null;
  },
  async getSupplierContact(id: string): Promise<{ email: string } | null> {
    return id === "supplier-demo" ? { email: "supplier@example.test" } : null;
  }
};
