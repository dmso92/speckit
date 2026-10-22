import { test, expect } from "@playwright/test";

test("records partial shipments, displays cumulative history, and preserves it on cancellation", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Quantity").fill("3");
  await page.getByLabel("Unit price (cents)").fill("100");
  await page.getByRole("button", { name: "Create draft" }).click();
  const orderNumber = await page.locator("#order-detail-heading").innerText();
  await page.getByRole("button", { name: "Submit order" }).click();
  await page.getByLabel("Development actor").selectOption("fulfiller");
  await page.getByLabel("Received quantity for widget-demo").fill("1");
  await page.getByRole("button", { name: "Record shipment" }).click();
  await expect(page.locator(".order-detail").getByText("Partially Fulfilled", { exact: true })).toBeVisible();
  const receivedLine = page.getByRole("row").filter({ hasText: "widget-demo" });
  await expect(receivedLine).toContainText("3");
  await expect(receivedLine).toContainText("1");
  await expect(receivedLine).toContainText("2");
  await expect(page.getByRole("list", { name: "Fulfillment history" })).toContainText("1");
  await page.getByLabel("Development actor").selectOption("buyer");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.locator(".order-detail").getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Fulfillment history" })).toContainText("1");

  const listed = await page.request.get("http://127.0.0.1:3000/api/v1/purchase-orders", {
    headers: { Authorization: "Bearer dev-buyer" }
  });
  const orders = await listed.json() as { items: Array<{ id: string; orderNumber: string }> };
  const target = orders.items.find(order => order.orderNumber === orderNumber);
  if (!target) throw new Error("New purchase order was not returned by the API.");
  const unauthorizedHistory = await page.request.get(`http://127.0.0.1:3000/api/v1/purchase-orders/${target.id}/fulfillment-history`, {
    headers: { Authorization: "Bearer dev-other-supplier" }
  });
  expect(unauthorizedHistory.status()).toBe(403);
  const blocked = await page.request.post(`http://127.0.0.1:3000/api/v1/purchase-orders/${target.id}/fulfill`, {
    headers: { Authorization: "Bearer dev-fulfiller" },
    data: { items: [{ purchaseOrderLineItemId: "line-id", quantity: 1 }] }
  });
  expect(blocked.status()).toBe(409);
  await page.getByLabel("Development actor").selectOption("fulfiller");
  await page.getByRole("button", { name: new RegExp(orderNumber) }).click();
  await expect(page.getByRole("button", { name: "Record shipment" })).toHaveCount(0);
});
