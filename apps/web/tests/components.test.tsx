import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PurchaseOrderDetailPage } from "../src/features/purchase-orders/PurchaseOrderDetailPage.js";
import type { PurchaseOrder } from "../src/features/purchase-orders/api.js";

const sample: PurchaseOrder = {
  id: "po-1", orderNumber: "PO-1", branchId: "branch-demo", supplierId: "supplier-demo", createdBy: "buyer",
  status: "Draft", totalCents: 2500, items: [{
    id: "line-1", productId: "p", productName: "Sample part", sku: null,
    quantity: 2, unitPriceCents: 1250, lineTotalCents: 2500
  }], approvalDecision: null
};

describe("purchase order detail screen", () => {
  it("shows line details, computed amounts, status, and an accessible submit action", () => {
    render(<PurchaseOrderDetailPage order={sample} actorKind="buyer" onSubmit={() => undefined} onEdit={() => undefined} onFulfill={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByText("Sample part")).toBeTruthy();
    expect(screen.getByText("Total: $25.00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit order" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save draft changes" })).toBeTruthy();
  });
});
