import type { Actor } from "./actor.js";

export interface AuthorizationPort {
  canCreateDraft(actor: Actor, branchId: string): boolean;
  canManageOrder(actor: Actor, createdBy: string, branchId: string): boolean;
  canApprove(actor: Actor, createdBy: string): boolean;
  canFulfill(actor: Actor): boolean;
  canViewSupplier(actor: Actor, supplierId: string): boolean;
}

export const defaultAuthorization: AuthorizationPort = {
  canCreateDraft: (actor, branchId) => actor.roles.includes("buyer") && actor.branchIds.includes(branchId),
  canManageOrder: (actor, createdBy, branchId) => actor.roles.includes("buyer") && actor.id === createdBy && actor.branchIds.includes(branchId),
  canApprove: (actor, createdBy) => actor.roles.includes("approver") && actor.id !== createdBy,
  canFulfill: actor => actor.roles.includes("fulfiller"),
  canViewSupplier: (actor, supplierId) => actor.roles.includes("supplier") && actor.supplierIds.includes(supplierId)
};
