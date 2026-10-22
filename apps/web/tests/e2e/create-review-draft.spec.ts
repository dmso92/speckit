import { test, expect } from "@playwright/test";

test("buyer can create and review a draft using the development-only fixture mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Development fixtures enabled")).toBeVisible();
  await page.getByLabel("Branch identifier").fill("branch-demo");
  await page.getByLabel("Supplier identifier").fill("supplier-demo");
  await page.getByLabel("Product identifier").fill("widget-demo");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit price (cents)").fill("1250");
  await page.getByRole("button", { name: "Add line item" }).click();
  await page.getByLabel("Product identifier").nth(1).fill("widget-alt");
  await page.getByLabel("Quantity").nth(1).fill("1");
  await page.getByLabel("Unit price (cents)").nth(1).fill("4000");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByText("Total: $65.00")).toBeVisible();
  await page.getByLabel("Quantity").nth(0).fill("3");
  await page.getByRole("button", { name: "Save draft changes" }).click();
  await expect(page.getByText("Total: $77.50")).toBeVisible();
});
