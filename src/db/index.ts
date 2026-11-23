import { createClient, type ResultSet } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { ensureDemoUsers, seedIfEmpty } from "./seed";

export type Db = LibSQLDatabase<typeof schema>;
/** Banco ou transação aberta: as funções de domínio aceitam os dois. */
export type DbLike = BaseSQLiteDatabase<"async", ResultSet, typeof schema>;

export const DATA_DIR = process.env.AEX_DATA_DIR || path.join(process.cwd(), "data");

/**
 * Abre o banco e aplica as migrações.
 * - Produção (Vercel): Turso, via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 * - Local: arquivo SQLite em data/ (file:...), ou ":memory:" nos testes.
 */
export async function createDb(url: string, authToken?: string): Promise<Db> {
  if (url.startsWith("file:")) fs.mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
  const client = createClient({ url, authToken });
  if (!url.startsWith("libsql:") && !url.startsWith("https:")) await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL) throw new Error("Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no projeto da Vercel.");
  return `file:${path.join(DATA_DIR, "aexpenses.db")}`;
}

const globalForDb = globalThis as unknown as { __aexDb?: Promise<Db> };

/** Banco da aplicação: aberto, migrado e com seed uma vez por instância (sobrevive ao hot reload em dev). */
export function getDb(): Promise<Db> {
  if (!globalForDb.__aexDb) {
    globalForDb.__aexDb = (async () => {
      const db = await createDb(databaseUrl(), process.env.TURSO_AUTH_TOKEN);
      await seedIfEmpty(db);
      await ensureDemoUsers(db);
      return db;
    })().catch((error) => {
      globalForDb.__aexDb = undefined;
      throw error;
    });
  }
  return globalForDb.__aexDb;
}

export { schema };
