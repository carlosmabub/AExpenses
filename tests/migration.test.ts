import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb } from "@/db";
import { classifications, expenses, transactions } from "@/db/schema";
import { seedIfEmpty } from "@/db/seed";
import { importBvk3 } from "@/lib/bvk3/import";
import { decodeBvk3 } from "@/lib/bvk3/parser";

const sample = decodeBvk3(readFileSync(path.join(__dirname, "fixtures/BVK3EXEMPLOMENSAL.txt")));
const migration = readFileSync(path.join(__dirname, "../drizzle/0002_reports-and-expenses.sql"), "utf8");
const copyStatement = migration.split("--> statement-breakpoint").find((s) => s.includes("INSERT INTO `expenses`"))!;

describe("migração 0002 (dados do primeiro piloto)", () => {
  it("transforma as compras importadas e suas classificações em despesas", async () => {
    const db = await createDb(":memory:");
    await seedIfEmpty(db);
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    // estado do primeiro piloto: só transactions + classifications
    const tx = (await db.select().from(transactions).all()).find((t) => t.merchant === "NA  LATA  BAR")!;
    await db.delete(expenses).run();
    await db.insert(classifications).values({ transactionId: tx.id, categoryId: 1, description: "Almoço", costCenter: "4383", receiptPath: "a.jpg", receiptMime: "image/jpeg", classifiedAt: "2013-07-23T11:00:00.000Z" }).run();

    await db.run(sql.raw(copyStatement));

    const rows = await db.select().from(expenses).all();
    expect(rows).toHaveLength(82);
    const migrated = rows.find((e) => e.transactionId === tx.id)!;
    expect(migrated).toMatchObject({ source: "cartao", paymentMethod: "cartao", categoryId: 1, description: "Almoço", receiptPath: "a.jpg", savedAt: "2013-07-23T11:00:00.000Z" });
    // compra de 21/07, chegou em 23/07: prazo no fim de julho, 23:59 de Brasília
    expect(migrated.dueAt).toBe("2013-08-01T02:59:59.000Z");
    // rodar de novo não duplica
    await db.run(sql.raw(copyStatement));
    expect(await db.select().from(expenses).all()).toHaveLength(82);
  });
});
