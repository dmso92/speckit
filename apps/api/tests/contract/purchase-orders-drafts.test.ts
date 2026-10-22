import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplication } from "../support/test-application.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

describe("draft purchase-order REST contract", () => {
  it("creates, lists, reads, and updates drafts with server-calculated totals", async () => {
    const testApp = createTestApplication();
    cleanups.push(testApp.cleanup);
    const app = createApp(testApp.dependencies);
    const headers = { Authorization: "Bearer buyer-test" };
    const created = await request(app).post("/api/v1/purchase-orders").set(headers).send({
      branchId: "branch-demo", supplierId: "supplier-demo",
      items: [{ productId: "widget", quantity: 2, unitPriceCents: 1250 }]
    }).expect(201);
    expect(created.body.status).toBe("Draft");
    expect(created.body.totalCents).toBe(2500);
    expect(created.body.items[0]).toMatchObject({ productName: expect.any(String), sku: expect.anything(), lineTotalCents: 2500 });
    expect(created.body.items[0]).not.toHaveProperty("productNameSnapshot");
    await request(app).get("/api/v1/purchase-orders").set(headers).expect(200);
    await request(app).get(`/api/v1/purchase-orders/${created.body.id}`).set(headers).expect(200);
    const updated = await request(app).patch(`/api/v1/purchase-orders/${created.body.id}`).set(headers).send({
      items: [{ productId: "widget", quantity: 3, unitPriceCents: 1000 }]
    }).expect(200);
    expect(updated.body.totalCents).toBe(3000);
  });
  it("fails closed without an authenticated actor", async () => {
    const testApp = createTestApplication();
    cleanups.push(testApp.cleanup);
    await request(createApp(testApp.dependencies)).get("/api/v1/purchase-orders").expect(401);
  });
});
