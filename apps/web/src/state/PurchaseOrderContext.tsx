import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { PurchaseOrder } from "../features/purchase-orders/api.js";

interface PurchaseOrderContextValue {
  orders: PurchaseOrder[];
  setOrders: Dispatch<SetStateAction<PurchaseOrder[]>>;
}

const PurchaseOrderContext = createContext<PurchaseOrderContextValue | null>(null);

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  return <PurchaseOrderContext.Provider value={{ orders, setOrders }}>{children}</PurchaseOrderContext.Provider>;
}

export function usePurchaseOrders(): PurchaseOrderContextValue {
  const context = useContext(PurchaseOrderContext);
  if (!context) throw new Error("usePurchaseOrders must be used inside PurchaseOrderProvider.");
  return context;
}
