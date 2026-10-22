export interface SupplierCatalog {
  getSupplierContact(supplierId: string): Promise<{ email: string } | null>;
}
