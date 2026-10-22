import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

export function createTempDatabasePath(): string {
  return join(tmpdir(), `purchase-orders-${randomUUID()}.sqlite`);
}

export function removeTempDatabase(path: string): void {
  for (const suffix of ["", "-shm", "-wal"]) rmSync(`${path}${suffix}`, { force: true });
}
