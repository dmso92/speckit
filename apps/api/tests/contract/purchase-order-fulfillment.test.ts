import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplication } from "../support/test-application.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

describe("shipment and fulfillment-history REST contract", () => {
  it("records partial and final shipments and returns chronological history", async () => {
    const testApp = createTestApplication(); cleanups.push(testApp.cleanup);
    const app = createApp(testApp.dependencies);
    const buyer = "Bearer buyer-test";
    const fulfiller = "Bearer fulfiller-test";
    const created = await request(app).post("/api/v1/purchase-orders").set("Authorization", buyer).send({
      branchId: "branch-demo", supplierId: "supplier-demo", items: [{ productId: "p", quantity: 3, unitPriceCents: 10 }]
    }).expect(201);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/submit`).set("Authorization", buyer).expect(200);
    const lineId = created.body.items[0].id as string;
    await request(app).get(`/api/v1/purchase-orders/${created.body.id}/fulfillment-history`).set("Authorization", buyer)
      .expect(200).expect(({ body }) => expect(body.shipments).toEqual([]));
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", fulfiller)
      .send({ items: [{ purchaseOrderLineItemId: lineId, quantity: 1 }] }).expect(200)
      .expect(({ body }) => { expect(body.status).toBe("Partially Fulfilled"); expect(body.items[0].receivedQuantity).toBe(1); });
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", fulfiller)
      .send({ items: [{ purchaseOrderLineItemId: lineId, quantity: 2 }] }).expect(200)
      .expect(({ body }) => expect(body.status).toBe("Fulfilled"));
    await request(app).get(`/api/v1/purchase-orders/${created.body.id}/fulfillment-history`).set("Authorization", buyer)
      .expect(200).expect(({ body }) => {
        expect(body.shipments).toHaveLength(2);
        expect(new Date(body.shipments[0].recordedAt).getTime()).toBeLessThanOrEqual(new Date(body.shipments[1].recordedAt).getTime());
        expect(body.shipments[0].items).toEqual([{ purchaseOrderLineItemId: lineId, quantity: 1 }]);
        expect(body.shipments[0].recordedBy).toBe("fulfiller-test");
      });
  });

  it("rejects invalid/over-ordered shipments atomically, authorizes history, and preserves history on cancellation", async () => {
    const testApp = createTestApplication(); cleanups.push(testApp.cleanup);
    const app = createApp(testApp.dependencies);
    const buyer = "Bearer buyer-test";
    const fulfiller = "Bearer fulfiller-test";
    const created = await request(app).post("/api/v1/purchase-orders").set("Authorization", buyer).send({
      branchId: "branch-demo", supplierId: "supplier-demo", items: [{ productId: "p", quantity: 2, unitPriceCents: 10 }]
    }).expect(201);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/submit`).set("Authorization", buyer).expect(200);
    const lineId = created.body.items[0].id as string;
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", fulfiller)
      .send({ items: [] }).expect(422);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", fulfiller)
      .send({ items: [{ purchaseOrderLineItemId: lineId, quantity: 1.5 }] }).expect(422);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", fulfiller)
      .send({ items: [{ purchaseOrderLineItemId: lineId, quantity: 3 }] }).expect(422);
    await request(app).get(`/api/v1/purchase-orders/${created.body.id}/fulfillment-history`).set("Authorization", "Bearer other-supplier-test").expect(403);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", fulfiller)
      .send({ items: [{ purchaseOrderLineItemId: lineId, quantity: 1 }] }).expect(200);
    const history = await request(app).get(`/api/v1/purchase-orders/${created.body.id}/fulfillment-history`).set("Authorization", buyer).expect(200);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/cancel`).set("Authorization", buyer).expect(200);
    await request(app).get(`/api/v1/purchase-orders/${created.body.id}/fulfillment-history`).set("Authorization", buyer)
      .expect(200).expect(({ body }) => expect(body.shipments).toEqual(history.body.shipments));
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", fulfiller)
      .send({ items: [{ purchaseOrderLineItemId: lineId, quantity: 1 }] }).expect(409);
  });
});
