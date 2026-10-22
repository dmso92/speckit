export type ActorRole = "buyer" | "approver" | "fulfiller" | "supplier";

export interface Actor {
  id: string;
  roles: ActorRole[];
  branchIds: string[];
  supplierIds: string[];
}
