import { DomainError, type ApprovalValue, type PurchaseOrder } from "../domain/purchase-order.js";
import type { Actor } from "../ports/actor.js";
import { defaultAuthorization, type AuthorizationPort } from "../ports/authorization.js";
import type { PurchaseOrderRepository } from "../sqlite/purchase-order-repository.js";

export class PurchaseOrderLifecycle {
  constructor(private readonly repository: PurchaseOrderRepository, private readonly authorization: AuthorizationPort = defaultAuthorization) {}

  decide(actor: Actor, id: string, decision: ApprovalValue, reason: string | null = null): PurchaseOrder {
    const order = this.requireOrder(id);
    const designated = actor.roles.includes("approver");
    if (!this.authorization.canApprove(actor, order.createdBy)) throw new DomainError("A designated independent approver is required.", "forbidden");
    return this.repository.decide(id, actor.id, designated, decision, reason);
  }

  fulfill(actor: Actor, id: string): PurchaseOrder {
    if (!this.authorization.canFulfill(actor)) throw new DomainError("A fulfiller role is required.", "forbidden");
    this.requireOrder(id);
    return this.repository.fulfill(id);
  }

  cancel(actor: Actor, id: string): PurchaseOrder {
    const order = this.requireOrder(id);
    if (!this.authorization.canManageOrder(actor, order.createdBy, order.branchId ?? "")) throw new DomainError("Only the owning buyer can cancel this order.", "forbidden");
    return this.repository.cancel(id);
  }

  private requireOrder(id: string): PurchaseOrder {
    const order = this.repository.get(id);
    if (!order) throw new DomainError("Purchase order was not found.", "not_found");
    return order;
  }
}
