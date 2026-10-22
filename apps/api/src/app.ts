import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import type { Actor, AuthorizationPort, CatalogPort, PurchaseOrderRepository } from "@purchase-orders/library";
import { authentication, type ActorResolver } from "./http/middleware/authentication.js";
import { errorHandler } from "./http/middleware/error-handler.js";
import { loadOpenApiDocument, openApiYaml } from "./http/openapi.js";
import { createPurchaseOrdersRouter } from "./http/purchase-orders-router.js";
import { createSupplierNotificationsRouter } from "./http/supplier-notifications-router.js";

export interface AppDependencies {
  repository: PurchaseOrderRepository;
  catalog: CatalogPort;
  authorization?: AuthorizationPort;
  resolveActor: ActorResolver;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/openapi.yaml", (_req, res) => res.type("text/yaml").send(openApiYaml()));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(loadOpenApiDocument()));
  app.use("/api/v1", authentication(dependencies.resolveActor));
  app.use("/api/v1/purchase-orders", createPurchaseOrdersRouter(dependencies));
  app.use("/api/v1/supplier-notifications", createSupplierNotificationsRouter(dependencies.repository));
  app.use((_req, res) => res.status(404).json({ code: "NOT_FOUND", message: "Route not found." }));
  app.use(errorHandler);
  return app;
}

export function failClosedActorResolver(): ActorResolver {
  return async (_authorization: string | undefined): Promise<Actor | null> => null;
}
