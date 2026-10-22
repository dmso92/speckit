import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplication } from "../support/test-application.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

describe("approval and lifecycle REST contract", () => {
  it("enforces strict high-value threshold and independent approval", async () => {
    const testApp = createTestApplication();
    cleanups.push(testApp.cleanup);
    const app = createApp(testApp.dependencies);
    const created = await request(app).post("/api/v1/purchase-orders").set("Authorization", "Bearer buyer-test").send({
      branchId: "branch-demo", supplierId: "supplier-demo",
      items: [{ productId: "high-value", quantity: 1, unitPriceCents: 1_000_001 }]
    }).expect(201);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/submit`).set("Authorization", "Bearer buyer-test").expect(200);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", "Bearer fulfiller-test").expect(409);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/approval-decisions`).set("Authorization", "Bearer buyer-test").send({ decision: "Approved" }).expect(403);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/approval-decisions`).set("Authorization", "Bearer approver-test").send({ decision: "Approved" }).expect(200);
    await request(app).post(`/api/v1/purchase-orders/${created.body.id}/fulfill`).set("Authorization", "Bearer fulfiller-test").expect(200);
  });

  it("allows exact-threshold fulfillment and keeps a rejected order unfulfilled until cancellation", async () => {
    const testApp = createTestApplication();
    cleanups.push(testApp.cleanup);
    const app = createApp(testApp.dependencies);
    const buyer = "Bearer buyer-test";
    const fulfiller = "Bearer fulfiller-test";
    const low = await request(app).post("/api/v1/purchase-orders").set("Authorization", buyer).send({
      branchId: "branch-demo", supplierId: "supplier-demo",
      items: [{ productId: "exact-threshold", quantity: 1, unitPriceCents: 1_000_000 }]
    }).expect(201);
    await request(app).post(`/api/v1/purchase-orders/${low.body.id}/submit`).set("Authorization", buyer).expect(200);
    await request(app).post(`/api/v1/purchase-orders/${low.body.id}/fulfill`).set("Authorization", fulfiller).expect(200).expect(({ body }) => expect(body.status).toBe("Fulfilled"));

    const high = await request(app).post("/api/v1/purchase-orders").set("Authorization", buyer).send({
      branchId: "branch-demo", supplierId: "supplier-demo",
      items: [{ productId: "rejected-order", quantity: 1, unitPriceCents: 1_000_001 }]
    }).expect(201);
    await request(app).post(`/api/v1/purchase-orders/${high.body.id}/submit`).set("Authorization", buyer).expect(200);
    const rejected = await request(app).post(`/api/v1/purchase-orders/${high.body.id}/approval-decisions`)
      .set("Authorization", "Bearer approver-test").send({ decision: "Rejected" }).expect(200);
    expect(rejected.body.status).toBe("Submitted");
    expect(rejected.body.approvalDecision.decision).toBe("Rejected");
    await request(app).post(`/api/v1/purchase-orders/${high.body.id}/fulfill`).set("Authorization", fulfiller).expect(409);
    await request(app).get(`/api/v1/purchase-orders/${high.body.id}`).set("Authorization", buyer).expect(200).expect(({ body }) => expect(body.status).toBe("Submitted"));
    await request(app).post(`/api/v1/purchase-orders/${high.body.id}/cancel`).set("Authorization", buyer).expect(200).expect(({ body }) => expect(body.status).toBe("Cancelled"));
  });
});
