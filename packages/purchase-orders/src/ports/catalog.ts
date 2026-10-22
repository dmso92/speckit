export interface CatalogReference {
  id: string;
  name: string;
}

export interface CatalogProduct extends CatalogReference {
  sku: string | null;
}

export interface CatalogPort {
  validateReference(kind: "branch" | "supplier", id: string): Promise<CatalogReference | null>;
  getProduct(id: string): Promise<CatalogProduct | null>;
  getSupplierContact(id: string): Promise<{ email: string } | null>;
}
