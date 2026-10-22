import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const library = resolve(process.cwd(), "packages/purchase-orders/src/index.ts");

export default defineConfig({
  resolve: { alias: { "@purchase-orders/library": library } },
  test: {
    projects: [
      { test: { name: "library-unit", include: ["packages/purchase-orders/tests/unit/**/*.test.ts"], environment: "node" } },
      { test: { name: "library-integration", include: ["packages/purchase-orders/tests/integration/**/*.test.ts"], environment: "node" } },
      { test: { name: "api-contract", include: ["apps/api/tests/contract/**/*.test.ts"], environment: "node" } },
      { test: { name: "web-unit", include: ["apps/web/tests/**/*.test.tsx"], environment: "jsdom" } }
    ]
  }
});
