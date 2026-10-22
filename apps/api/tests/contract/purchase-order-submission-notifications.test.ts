import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplication } from "../support/test-application.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

describe("submission and supplier notification REST contract", () => {
  it("submits once and scopes notifications to the authenticated supplier", async () => {
    const testApp = createTestApplication();
    cleanups.push(testApp.cleanup);
    const app = createApp(testApp.dependencies);
    const created = await request(app).post("/api/v1/purchase-orders").set("Authorization", "Bearer buyer-test").send({
      branchId: "branch-demo", supplierId: "supplier-demo",
      items: [{ productId: "widget", quantity: 1, unitPriceCents: 300 }]
    }).expect(201);
    const submitted = await request(app).post(`/api/v1/purchase-orders/${created.body.id}/submit`).set("Authorization", "Bearer buyer-test").expect(200);
    expect(submitted.body.status).toBe("Submitted");
    const inbox = await request(app).get("/api/v1/supplier-notifications").set("Authorization", "Bearer supplier-test").expect(200);
    expect(inbox.body.items).toHaveLength(1);
    expect(inbox.body).toHaveProperty("totalItems", 1);
    expect(inbox.body.items[0]).toMatchObject({ eventType: "purchase_order_submitted", summary: [expect.objectContaining({ productName: expect.any(String) })] });
    await request(app).post(`/api/v1/supplier-notifications/${inbox.body.items[0].id}/read`).set("Authorization", "Bearer supplier-test").expect(204);
    await request(app).get("/api/v1/supplier-notifications").set("Authorization", "Bearer other-supplier-test").expect(200).expect(({ body }) => expect(body.items).toHaveLength(0));
  });
});
