import { test, expect } from "@playwright/test";

test("approval controls show only when a designated development approver is selected", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Unit price (cents)").fill("1000001");
  await page.getByRole("button", { name: "Create draft" }).click();
  const orderNumber = await page.locator("#order-detail-heading").innerText();
  await page.getByRole("button", { name: "Submit order" }).click();
  await page.getByLabel("Development actor").selectOption("approver");
  const approvalCard = page.locator(".approval-card").filter({ hasText: orderNumber });
  await expect(approvalCard).toBeVisible();
  await approvalCard.getByRole("button", { name: "Approve" }).click();
  await page.getByLabel("Development actor").selectOption("fulfiller");
  const orderRow = page.getByRole("button", { name: new RegExp(orderNumber) });
  await orderRow.click();
  await expect(page.locator(".order-detail").getByText("Approved", { exact: true })).toBeVisible();
  await page.getByLabel("Received quantity for widget-demo").fill("2");
  await page.getByRole("button", { name: "Record shipment" }).click();
  await expect(page.locator(".order-detail").getByText("Fulfilled", { exact: true })).toBeVisible();
});

test("rejected high-value orders cannot receive shipments and may be cancelled by their buyer", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit price (cents)").fill("1000001");
  await page.getByRole("button", { name: "Create draft" }).click();
  const orderNumber = await page.locator("#order-detail-heading").innerText();
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(page.getByRole("button", { name: "Record shipment" })).toHaveCount(0);

  const listedOrders = await page.request.get("http://127.0.0.1:3000/api/v1/purchase-orders", {
    headers: { Authorization: "Bearer dev-buyer" }
  });
  const pageBody = await listedOrders.json() as { items: Array<{ id: string; orderNumber: string }> };
  const target = pageBody.items.find(order => order.orderNumber === orderNumber);
  if (!target) throw new Error("New high-value order was not returned by the API.");
  const deniedFulfillment = await page.request.post(`http://127.0.0.1:3000/api/v1/purchase-orders/${target.id}/fulfill`, {
    headers: { Authorization: "Bearer dev-fulfiller" },
    data: { items: [{ purchaseOrderLineItemId: "unknown-line", quantity: 1 }] }
  });
  expect(deniedFulfillment.status()).toBe(409);

  await page.getByLabel("Development actor").selectOption("approver");
  const approvalCard = page.locator(".approval-card").filter({ hasText: orderNumber });
  await approvalCard.getByRole("button", { name: "Reject" }).click();
  await page.getByLabel("Development actor").selectOption("buyer");
  await page.getByRole("button", { name: new RegExp(orderNumber) }).click();
  await expect(page.locator(".order-detail").getByText(/Decision: Rejected/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.locator(".order-detail").getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
});
