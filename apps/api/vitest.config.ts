import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "api-contract",
          include: ["tests/contract/**/*.test.ts"],
          environment: "node"
        },
        resolve: { alias: { "@purchase-orders/library": fileURLToPath(new URL("../../packages/purchase-orders/src/index.ts", import.meta.url)) } }
      }
    ]
  }
});
