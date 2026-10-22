import { Router } from "express";
import { DraftPurchaseOrders, DomainError, defaultAuthorization, PurchaseOrderLifecycle, SubmitPurchaseOrder } from "@purchase-orders/library";
import type { ApprovalValue, AuthorizationPort, DraftLineInput, DraftUpdate, PurchaseOrderStatus, Actor, CatalogPort, PurchaseOrderRepository } from "@purchase-orders/library";
import { toPurchaseOrderPageResponse, toPurchaseOrderResponse } from "./purchase-order-response.js";

export interface PurchaseOrdersRouterOptions {
  repository: PurchaseOrderRepository;
  catalog: CatalogPort;
  authorization?: AuthorizationPort;
}

function requireActor(actor: Actor | null): Actor {
  if (!actor) throw new DomainError("A valid authenticated actor is required.", "forbidden");
  return actor;
}

function canReadOrder(actor: Actor, createdBy: string, branchId: string | null, supplierId: string | null, authorization: AuthorizationPort): boolean {
  return (actor.roles.includes("buyer") && authorization.canManageOrder(actor, createdBy, branchId ?? "")) ||
    (actor.roles.includes("approver") || actor.roles.includes("fulfiller")) ||
    (supplierId !== null && authorization.canViewSupplier(actor, supplierId));
}

function parseDraftBody(value: unknown): { branchId?: string | null; supplierId?: string | null; items?: DraftLineInput[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DomainError("Request body must be a JSON object.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["branchId", "supplierId", "items"].includes(key))) throw new DomainError("Request contains unsupported fields.");
  for (const key of ["branchId", "supplierId"] as const) {
    if (key in body && body[key] !== null && typeof body[key] !== "string") throw new DomainError(`${key} must be a string or null.`);
  }
  if ("items" in body && !Array.isArray(body.items)) throw new DomainError("items must be an array.");
  const items = body.items as unknown[] | undefined;
  const parsedItems = items?.map((value): DraftLineInput => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new DomainError("Each line item must be a JSON object.");
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some(key => !["productId", "quantity", "unitPriceCents"].includes(key))) throw new DomainError("Line item contains unsupported fields.");
    if (typeof item.productId !== "string" || typeof item.quantity !== "number" || typeof item.unitPriceCents !== "number") {
      throw new DomainError("Each line item requires productId, quantity, and unitPriceCents.");
    }
    return { productId: item.productId, quantity: item.quantity, unitPriceCents: item.unitPriceCents };
  });
  return {
    ...( "branchId" in body ? { branchId: body.branchId as string | null } : {}),
    ...( "supplierId" in body ? { supplierId: body.supplierId as string | null } : {}),
    ...( parsedItems ? { items: parsedItems } : {})
  };
}

function parseShipmentBody(value: unknown): Array<{ purchaseOrderLineItemId: string; quantity: number }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DomainError("Request body must be a JSON object.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => key !== "items") || !Array.isArray(body.items) || body.items.length === 0) {
    throw new DomainError("A shipment must contain a non-empty items array.");
  }
  return body.items.map((value): { purchaseOrderLineItemId: string; quantity: number } => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new DomainError("Each shipment line must be a JSON object.");
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some(key => !["purchaseOrderLineItemId", "quantity"].includes(key)) ||
      typeof item.purchaseOrderLineItemId !== "string" || typeof item.quantity !== "number") {
      throw new DomainError("Each shipment line requires purchaseOrderLineItemId and quantity.");
    }
    return { purchaseOrderLineItemId: item.purchaseOrderLineItemId, quantity: item.quantity };
  });
}

export function createPurchaseOrdersRouter(options: PurchaseOrdersRouterOptions): Router {
  const router = Router();
  const { repository, catalog } = options;
  const authorization = options.authorization ?? defaultAuthorization;
  const drafts = new DraftPurchaseOrders(repository, catalog, authorization);
  const submissions = new SubmitPurchaseOrder(repository, catalog, authorization);
  const lifecycle = new PurchaseOrderLifecycle(repository, authorization);

  router.get("/", (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      const status = typeof req.query.status === "string" ? req.query.status as PurchaseOrderStatus : undefined;
      if (status && !["Draft", "Submitted", "Approved", "Partially Fulfilled", "Fulfilled", "Cancelled"].includes(status)) throw new DomainError("Status filter is not supported.");
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 25);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new DomainError("Page must be positive and pageSize must be between 1 and 100.");
      }
      let result: ReturnType<PurchaseOrderRepository["list"]>;
      if (actor.roles.includes("supplier")) {
        const visible = actor.supplierIds.flatMap(supplierId => repository.list({ ...(status ? { status } : {}), supplierId, page: 1, pageSize: 100 }).items)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        result = { items: visible.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: visible.length };
      } else if (actor.roles.includes("approver") || actor.roles.includes("fulfiller")) {
        result = repository.list({ ...(status ? { status } : {}), page, pageSize });
      } else if (actor.roles.includes("buyer")) {
        result = repository.list({ ...(status ? { status } : {}), createdBy: actor.id, page, pageSize });
      } else {
        throw new DomainError("Actor is not authorized to view purchase orders.", "forbidden");
      }
      res.json(toPurchaseOrderPageResponse(result));
    } catch (error) { next(error); }
  });

  router.post("/", async (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      const body = parseDraftBody(req.body);
      const order = await drafts.create(actor, {
        branchId: typeof body.branchId === "string" ? body.branchId : null,
        supplierId: typeof body.supplierId === "string" ? body.supplierId : null,
        items: body.items ?? []
      });
      res.status(201).json(toPurchaseOrderResponse(order));
    } catch (error) { next(error); }
  });

  router.get("/:purchaseOrderId", (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      const order = repository.get(req.params.purchaseOrderId);
      if (!order || !canReadOrder(actor, order.createdBy, order.branchId, order.supplierId, authorization)) throw new DomainError("Purchase order was not found.", "not_found");
      res.json(toPurchaseOrderResponse(order));
    } catch (error) { next(error); }
  });

  router.patch("/:purchaseOrderId", async (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      const body = parseDraftBody(req.body);
      if (Object.keys(body).length === 0) throw new DomainError("At least one draft field must be supplied.");
      const order = await drafts.update(actor, req.params.purchaseOrderId, body as DraftUpdate);
      res.json(toPurchaseOrderResponse(order));
    } catch (error) { next(error); }
  });

  router.post("/:purchaseOrderId/submit", async (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      const submitted = await submissions.submit(actor, req.params.purchaseOrderId);
      res.json(toPurchaseOrderResponse(submitted));
    } catch (error) { next(error); }
  });

  router.post("/:purchaseOrderId/approval-decisions", (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      const order = repository.get(req.params.purchaseOrderId);
      if (!order) throw new DomainError("Purchase order was not found.", "not_found");
      const decision = req.body?.decision as ApprovalValue;
      if (decision !== "Approved" && decision !== "Rejected") throw new DomainError("Decision must be Approved or Rejected.");
      res.json(toPurchaseOrderResponse(lifecycle.decide(actor, order.id, decision, typeof req.body.reason === "string" ? req.body.reason : null)));
    } catch (error) { next(error); }
  });

  router.post("/:purchaseOrderId/fulfill", (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      res.json(toPurchaseOrderResponse(lifecycle.fulfill(actor, req.params.purchaseOrderId, parseShipmentBody(req.body))));
    } catch (error) { next(error); }
  });

  router.get("/:purchaseOrderId/fulfillment-history", (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      const order = repository.get(req.params.purchaseOrderId);
      if (!order) throw new DomainError("Purchase order was not found.", "not_found");
      res.json({ purchaseOrderId: order.id, shipments: lifecycle.fulfillmentHistory(actor, order.id) });
    } catch (error) { next(error); }
  });

  router.post("/:purchaseOrderId/cancel", (req, res, next) => {
    try {
      const actor = requireActor(res.locals.actor);
      res.json(toPurchaseOrderResponse(lifecycle.cancel(actor, req.params.purchaseOrderId)));
    } catch (error) { next(error); }
  });

  return router;
}
