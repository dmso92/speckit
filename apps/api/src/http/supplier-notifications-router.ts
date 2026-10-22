import { Router } from "express";
import { DomainError } from "@purchase-orders/library";
import type { Actor, PurchaseOrderRepository } from "@purchase-orders/library";

export function createSupplierNotificationsRouter(repository: PurchaseOrderRepository): Router {
  const router = Router();
  router.get("/", (req, res, next) => {
    try {
      const actor = res.locals.actor as Actor | null;
      if (!actor || !actor.roles.includes("supplier")) throw new DomainError("Supplier access is required.", "forbidden");
      const unreadOnly = req.query.unreadOnly === "true";
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 25);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new DomainError("Page must be positive and pageSize must be between 1 and 100.");
      const all = actor.supplierIds.flatMap(id => repository.listSupplierNotifications(id, unreadOnly));
      const items = all.slice((page - 1) * pageSize, page * pageSize).map(notification => ({
        id: notification.id,
        purchaseOrderId: notification.purchaseOrderId,
        orderNumber: notification.payload.orderNumber,
        eventType: "purchase_order_submitted",
        summary: notification.payload.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.lineTotalCents
        })),
        totalCents: notification.payload.totalCents,
        createdAt: notification.createdAt,
        readAt: notification.readAt
      }));
      res.json({ items, page, pageSize, totalItems: all.length });
    } catch (error) { next(error); }
  });
  router.post("/:notificationId/read", (req, res, next) => {
    try {
      const actor = res.locals.actor as Actor | null;
      if (!actor || !actor.roles.includes("supplier")) throw new DomainError("Supplier access is required.", "forbidden");
      const updated = actor.supplierIds.some(id => repository.markSupplierNotificationRead(req.params.notificationId, id));
      if (!updated) throw new DomainError("Supplier notification was not found.", "not_found");
      res.status(204).end();
    } catch (error) { next(error); }
  });
  return router;
}
