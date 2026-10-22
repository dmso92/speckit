import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateDatabase } from "./migrate.js";

const defaultDatabasePath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/purchase-orders.sqlite");

export function openDatabase(path = process.env.PO_DB_PATH ?? defaultDatabasePath): Database.Database {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  migrateDatabase(db);
  return db;
}

export function closeDatabase(db: Database.Database): void {
  if (db.open) db.close();
}
