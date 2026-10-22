import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

function contractPath(): string {
  const fromModule = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../specs/001-purchase-order-management/contracts/openapi.yaml");
  const candidates = [resolve(process.cwd(), "specs/001-purchase-order-management/contracts/openapi.yaml"), fromModule];
  const match = candidates.find(existsSync);
  if (!match) throw new Error("Purchase-order OpenAPI contract could not be located.");
  return match;
}

export function loadOpenApiDocument(): Record<string, unknown> {
  return YAML.parse(readFileSync(contractPath(), "utf8")) as Record<string, unknown>;
}

export function openApiYaml(): string {
  return readFileSync(contractPath(), "utf8");
}
