import { test, expect } from "@playwright/test";

test("buyer submits a complete order and sees its status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Development fixtures enabled")).toBeVisible();
  await page.getByRole("button", { name: "Create draft" }).click();
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(page.getByText("Submitted", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Development actor").selectOption("supplier");
  await expect(page.getByRole("heading", { name: "Supplier notifications" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as read" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Mark as read" }).first().click();
  await expect(page.getByText("Read").first()).toBeVisible();
});
