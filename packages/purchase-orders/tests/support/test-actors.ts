import type { Actor } from "../../src/ports/actor.js";

export const buyerActor: Actor = { id: "buyer-demo", roles: ["buyer"], branchIds: ["branch-demo"], supplierIds: [] };
export const approverActor: Actor = { id: "approver-demo", roles: ["approver"], branchIds: [], supplierIds: [] };
export const fulfillerActor: Actor = { id: "fulfiller-demo", roles: ["fulfiller"], branchIds: [], supplierIds: [] };
export const supplierActor: Actor = { id: "supplier-user-demo", roles: ["supplier"], branchIds: [], supplierIds: ["supplier-demo"] };
