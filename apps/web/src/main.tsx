import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ActorProvider } from "./state/ActorContext.js";
import { PurchaseOrderProvider } from "./state/PurchaseOrderContext.js";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><ActorProvider><PurchaseOrderProvider><App /></PurchaseOrderProvider></ActorProvider></StrictMode>
);
