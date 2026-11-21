import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

export type Db = BetterSQLite3Database<typeof schema>;
/** Banco ou transação aberta: as funções de domínio aceitam os dois. */
export type DbLike = BaseSQLiteDatabase<"sync", Database.RunResult, typeof schema>;

export function createDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export const DATA_DIR = process.env.AEX_DATA_DIR || path.join(process.cwd(), "data");

const globalForDb = globalThis as unknown as { __aexDb?: Db };

/** Banco da aplicação (singleton; sobrevive ao hot reload do Next em dev). */
export function getDb(): Db {
  if (!globalForDb.__aexDb) {
    const db = createDb(path.join(DATA_DIR, "aexpenses.db"));
    seedIfEmpty(db);
    globalForDb.__aexDb = db;
  }
  return globalForDb.__aexDb;
}

export { schema };
