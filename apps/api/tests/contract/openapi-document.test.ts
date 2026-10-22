import { describe, expect, it } from "vitest";
import SwaggerParser from "@apidevtools/swagger-parser";
import { resolve } from "node:path";

describe("OpenAPI contract document", () => {
  it("validates the supplied OpenAPI 3.1 document and exposes required resources", async () => {
    const contract = await SwaggerParser.validate(resolve(process.cwd(), "specs/001-purchase-order-management/contracts/openapi.yaml"));
    expect(contract.openapi).toBe("3.1.0");
    expect(contract.paths).toHaveProperty("/purchase-orders");
    expect(contract.paths).toHaveProperty("/purchase-orders/{purchaseOrderId}/submit");
    expect(contract.paths).toHaveProperty("/supplier-notifications");
  });
});
