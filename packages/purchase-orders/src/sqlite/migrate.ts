import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

const names = ["001_purchase_orders.sql", "002_submission_notifications.sql", "003_approval_decisions.sql"];

export function migrateDatabase(db: Database.Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
  const sourceDir = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");
  const sourceFromBuildDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/sqlite/migrations");
  const candidates = [sourceDir, sourceFromBuildDir, resolve(process.cwd(), "packages/purchase-orders/src/sqlite/migrations")];
  for (const name of names) {
    const alreadyApplied = db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get(name);
    if (alreadyApplied) continue;
    const path = candidates.map(dir => resolve(dir, name)).find(existsSync);
    if (!path) throw new Error(`SQLite migration file is missing: ${name}`);
    const apply = db.transaction(() => {
      db.exec(readFileSync(path, "utf8"));
      db.prepare("INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
    });
    apply();
  }
}
