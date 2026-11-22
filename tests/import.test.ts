import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import { cards, categories, classifications, employees, transactions } from "@/db/schema";
import { seedIfEmpty } from "@/db/seed";
import { importBvk3 } from "@/lib/bvk3/import";
import { advanceClock, now, setSetting } from "@/lib/clock";
import { classifyExpense, listAdminExpenses, listEmployeeExpenses } from "@/lib/expenses";
import { decodeBvk3 } from "@/lib/bvk3/parser";

const sample = decodeBvk3(readFileSync(path.join(__dirname, "fixtures/BVK3EXEMPLOMENSAL.txt")));

async function employeeId(db: Db, name: string): Promise<number> {
  return (await db.select().from(employees).where(eq(employees.name, name)).get())!.id;
}

async function categoryId(db: Db, name: string): Promise<number> {
  return (await db.select().from(categories).where(eq(categories.name, name)).get())!.id;
}

describe("importação BVK3 + fluxo de classificação", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createDb(":memory:");
    await seedIfEmpty(db);
  });

  it("importa compras e saques, ignorando saldo/pagamento/ajuste", async () => {
    const result = await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    expect(result).toMatchObject({ imported: true, checkOk: true, newTransactions: 82, duplicateTransactions: 0, ignoredEntries: 17 });
    expect((await db.select().from(transactions).all()).filter((t) => t.kind === "saque")).toHaveLength(4);
  });

  it("não guarda o número completo do cartão", async () => {
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const stored = await db.select().from(cards).all();
    expect(JSON.stringify(stored)).not.toContain("4000000000000004000");
    expect(stored.map((c) => c.last4)).toContain("4000");
  });

  it("vincula cartões pelo nome do portador e lista os não vinculados", async () => {
    const result = await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    expect(result.unlinkedCards).toEqual(["NOME DO PORTADOR 09 (final 9000)"]);
    const billing = (await db.select().from(cards).all()).find((c) => c.holderName.startsWith("NOME DA EMPRESA"));
    expect(billing?.isBillingAccount).toBe(true);
  });

  it("reimportar o mesmo arquivo não duplica", async () => {
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const again = await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    expect(again).toMatchObject({ newTransactions: 0, duplicateTransactions: 82 });
    expect(await db.select().from(transactions).all()).toHaveLength(82);
  });

  it("recusa arquivo divergente, a menos que forçado", async () => {
    const tampered = sample.replace("+00000000000301985", "+00000000000301986");
    expect((await importBvk3(db, { fileName: "x.txt", content: tampered })).imported).toBe(false);
    expect((await importBvk3(db, { fileName: "x.txt", content: tampered, force: true })).imported).toBe(true);
  });

  it("sugere categoria pelo MCC", async () => {
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const diego = await employeeId(db, "Diego Rocha");
    await advanceClock(db, 60);
    const expenses = await listEmployeeExpenses(db, diego);
    const posto = expenses.find((e) => e.tx.merchant === "AUTO POSTO DA TORRE")!;
    const restaurante = expenses.find((e) => e.tx.merchant === "RANCHO COLONIAL")!;
    expect(posto.suggestedCategoryId).toBe(await categoryId(db, "Combustível"));
    expect(restaurante.suggestedCategoryId).toBe(await categoryId(db, "Alimentação"));
  });

  it("simula o arquivo diário: compras aparecem em D+1 da postagem e vencem em 48h", async () => {
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    // relógio começa na chegada do primeiro "arquivo diário"
    const start = await now(db);
    const diego = await employeeId(db, "Diego Rocha");
    const visibleAtStart = (await listEmployeeExpenses(db, diego)).length;

    await advanceClock(db, 20);
    const at = await now(db);
    const visible = await listEmployeeExpenses(db, diego);
    expect(visible.length).toBeGreaterThan(visibleAtStart);
    for (const e of visible) {
      expect(new Date(e.tx.availableAt).getTime()).toBeLessThanOrEqual(at.getTime());
      expect(new Date(e.tx.dueAt).getTime() - new Date(e.tx.availableAt).getTime()).toBe(48 * 3600 * 1000);
    }
    expect(visible.some((e) => e.status === "ignorada")).toBe(true);
    expect(start.toISOString()).toMatch(/T11:00:00/);
  });

  it("classificar remove a pendência; sem classificação vira ignorada para o admin", async () => {
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    await advanceClock(db, 60);
    const diego = await employeeId(db, "Diego Rocha");
    const [first] = await listEmployeeExpenses(db, diego);
    const category = first.suggestedCategoryId ?? (await categoryId(db, "Outros"));
    await classifyExpense(db, { transactionId: first.tx.id, employeeId: diego, categoryId: category, description: "Almoço com cliente", costCenter: "4383" });

    const admin = await listAdminExpenses(db, { employeeId: diego });
    expect(admin.find((e) => e.tx.id === first.tx.id)?.status).toBe("classificada");
    expect(admin.filter((e) => e.status === "ignorada").length).toBe(admin.length - 1);
  });

  it("não deixa classificar despesa de outro funcionário", async () => {
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    await advanceClock(db, 60);
    const [expense] = await listEmployeeExpenses(db, await employeeId(db, "Diego Rocha"));
    await expect(
      classifyExpense(db, {
        transactionId: expense.tx.id,
        employeeId: await employeeId(db, "Ana Souza"),
        categoryId: 1,
        description: "x",
        costCenter: "",
      }),
    ).rejects.toThrow(/não é sua/);
  });

  it("parcela nova da mesma compra herda a classificação", async () => {
    // Arquivo com a parcela 4/5 da compra BFSJP 35 (mesma compra, reference diferente)
    const parcel5 = sample.split(/\r?\n/).find((l) => l.includes("BFSJP 35"))!;
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    await advanceClock(db, 60);
    const bruno = await employeeId(db, "Bruno Lima");
    const expense = (await listEmployeeExpenses(db, bruno)).find((e) => e.tx.merchant === "BFSJP 35")!;
    await classifyExpense(db, { transactionId: expense.tx.id, employeeId: bruno, categoryId: expense.suggestedCategoryId ?? 1, description: "Uniforme", costCenter: "" });

    const parcel4 = parcel5.slice(0, 39) + "99999999999999999999999" + parcel5.slice(62, 74) + "00405" + parcel5.slice(79);
    const header = sample.split(/\r?\n/)[0];
    const holder = sample.split(/\r?\n/).find((l) => l.startsWith("1") && l.includes("PORTADOR 02"))!;
    const result = await importBvk3(db, { fileName: "parcela.txt", content: [header, holder, parcel4].join("\r\n"), force: true });
    expect(result.newTransactions).toBe(1);
    const inherited = (await db.select().from(classifications).all()).filter((c) => c.inheritedFromId !== null);
    expect(inherited).toHaveLength(1);
    expect(inherited[0].description).toBe("Uniforme");
  });

  it("prazo configurável", async () => {
    await setSetting(db, "deadline_hours", "24");
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const t = (await db.select().from(transactions).get())!;
    expect(new Date(t.dueAt).getTime() - new Date(t.availableAt).getTime()).toBe(24 * 3600 * 1000);
  });
});
