import { DomainError, validateDraftInput, type DraftInput, type DraftUpdate, type PurchaseOrder } from "../domain/purchase-order.js";
import type { Actor } from "../ports/actor.js";
import { defaultAuthorization, type AuthorizationPort } from "../ports/authorization.js";
import type { CatalogPort } from "../ports/catalog.js";
import type { PurchaseOrderRepository } from "../sqlite/purchase-order-repository.js";

export class DraftPurchaseOrders {
  constructor(
    private readonly repository: PurchaseOrderRepository,
    private readonly catalog: CatalogPort,
    private readonly authorization: AuthorizationPort = defaultAuthorization
  ) {}

  async create(actor: Actor, input: Omit<DraftInput, "createdBy">): Promise<PurchaseOrder> {
    if (!actor.roles.includes("buyer")) throw new DomainError("A buyer role is required.", "forbidden");
    if (!input.branchId || !input.supplierId) throw new DomainError("A branch and supplier are required to create a draft.");
    if (input.branchId && !this.authorization.canCreateDraft(actor, input.branchId)) throw new DomainError("Buyer is not authorized for this branch.", "forbidden");
    const normalized = await this.validateAndSnapshot(input);
    return this.repository.createDraft({ ...normalized, createdBy: actor.id });
  }

  async update(actor: Actor, id: string, input: DraftUpdate): Promise<PurchaseOrder> {
    const existing = this.repository.get(id);
    if (!existing) throw new DomainError("Purchase order was not found.", "not_found");
    if (!this.authorization.canManageOrder(actor, existing.createdBy, existing.branchId ?? "")) throw new DomainError("Buyer is not authorized to manage this order.", "forbidden");
    const targetBranchId = input.branchId === undefined ? existing.branchId : input.branchId;
    if (!targetBranchId || !this.authorization.canCreateDraft(actor, targetBranchId)) throw new DomainError("Buyer is not authorized for the target branch.", "forbidden");
    const normalized = await this.validateAndSnapshot({
      branchId: input.branchId === undefined ? existing.branchId : input.branchId,
      supplierId: input.supplierId === undefined ? existing.supplierId : input.supplierId,
      items: input.items === undefined ? existing.items : input.items
    });
    return this.repository.updateDraft(id, normalized);
  }

  private async validateAndSnapshot(input: { branchId: string | null; supplierId: string | null; items: DraftInput["items"] }): Promise<{ branchId: string | null; supplierId: string | null; items: DraftInput["items"] }> {
    validateDraftInput(input);
    if (input.branchId && !await this.catalog.validateReference("branch", input.branchId)) throw new DomainError("Branch was not found in the host catalog.");
    if (input.supplierId && !await this.catalog.validateReference("supplier", input.supplierId)) throw new DomainError("Supplier was not found in the host catalog.");
    const items = await Promise.all(input.items.map(async item => {
      const product = await this.catalog.getProduct(item.productId);
      if (!product) throw new DomainError(`Product ${item.productId} was not found in the host catalog.`);
      return { ...item, productNameSnapshot: product.name, skuSnapshot: product.sku };
    }));
    return { ...input, items };
  }
}
