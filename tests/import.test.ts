import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import { cards, classifications, employees, transactions } from "@/db/schema";
import { seedIfEmpty } from "@/db/seed";
import { importBvk3 } from "@/lib/bvk3/import";
import { advanceClock, now, setSetting } from "@/lib/clock";
import { classifyExpense, listAdminExpenses, listEmployeeExpenses } from "@/lib/expenses";
import { decodeBvk3 } from "@/lib/bvk3/parser";

const sample = decodeBvk3(readFileSync(path.join(__dirname, "fixtures/BVK3EXEMPLOMENSAL.txt")));

function employeeId(db: Db, name: string): number {
  return db.select().from(employees).where(eq(employees.name, name)).get()!.id;
}

describe("importação BVK3 + fluxo de classificação", () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(":memory:");
    seedIfEmpty(db);
  });

  it("importa compras e saques, ignorando saldo/pagamento/ajuste", () => {
    const result = importBvk3(db, { fileName: "exemplo.txt", content: sample });
    expect(result).toMatchObject({ imported: true, checkOk: true, newTransactions: 82, duplicateTransactions: 0, ignoredEntries: 17 });
    expect(db.select().from(transactions).all().filter((t) => t.kind === "saque")).toHaveLength(4);
  });

  it("não guarda o número completo do cartão", () => {
    importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const stored = JSON.stringify(db.select().from(cards).all());
    expect(stored).not.toContain("4000000000000004000");
    expect(db.select().from(cards).all().map((c) => c.last4)).toContain("4000");
  });

  it("vincula cartões pelo nome do portador e lista os não vinculados", () => {
    const result = importBvk3(db, { fileName: "exemplo.txt", content: sample });
    expect(result.unlinkedCards).toEqual(["NOME DO PORTADOR 09 (final 9000)"]);
    const billing = db.select().from(cards).all().find((c) => c.holderName.startsWith("NOME DA EMPRESA"));
    expect(billing?.isBillingAccount).toBe(true);
  });

  it("reimportar o mesmo arquivo não duplica", () => {
    importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const again = importBvk3(db, { fileName: "exemplo.txt", content: sample });
    expect(again).toMatchObject({ newTransactions: 0, duplicateTransactions: 82 });
    expect(db.select().from(transactions).all()).toHaveLength(82);
  });

  it("recusa arquivo divergente, a menos que forçado", () => {
    const tampered = sample.replace("+00000000000301985", "+00000000000301986");
    expect(importBvk3(db, { fileName: "x.txt", content: tampered }).imported).toBe(false);
    expect(importBvk3(db, { fileName: "x.txt", content: tampered, force: true }).imported).toBe(true);
  });

  it("sugere categoria pelo MCC", () => {
    importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const diego = employeeId(db, "Diego Rocha");
    advanceClock(db, 60);
    const posto = listEmployeeExpenses(db, diego).find((e) => e.tx.merchant === "AUTO POSTO DA TORRE")!;
    const restaurante = listEmployeeExpenses(db, diego).find((e) => e.tx.merchant === "RANCHO COLONIAL")!;
    const names = new Map(db.query.categories.findMany().sync().map((c) => [c.id, c.name]));
    expect(names.get(posto.suggestedCategoryId!)).toBe("Combustível");
    expect(names.get(restaurante.suggestedCategoryId!)).toBe("Alimentação");
  });

  it("simula o arquivo diário: compras aparecem em D+1 da postagem e vencem em 48h", () => {
    importBvk3(db, { fileName: "exemplo.txt", content: sample });
    // relógio começa na chegada do primeiro "arquivo diário"
    const start = now(db);
    const diego = employeeId(db, "Diego Rocha");
    const visibleAtStart = listEmployeeExpenses(db, diego).length;

    advanceClock(db, 20);
    const visible = listEmployeeExpenses(db, diego);
    expect(visible.length).toBeGreaterThan(visibleAtStart);
    for (const e of visible) {
      expect(new Date(e.tx.availableAt).getTime()).toBeLessThanOrEqual(now(db).getTime());
      expect(new Date(e.tx.dueAt).getTime() - new Date(e.tx.availableAt).getTime()).toBe(48 * 3600 * 1000);
    }
    expect(visible.some((e) => e.status === "ignorada")).toBe(true);
    expect(start.toISOString()).toMatch(/T11:00:00/);
  });

  it("classificar remove a pendência; sem classificação vira ignorada para o admin", () => {
    importBvk3(db, { fileName: "exemplo.txt", content: sample });
    advanceClock(db, 60);
    const diego = employeeId(db, "Diego Rocha");
    const [first] = listEmployeeExpenses(db, diego);
    const categoryId = first.suggestedCategoryId ?? db.query.categories.findFirst({ where: (c, { eq }) => eq(c.name, "Outros") }).sync()!.id;
    classifyExpense(db, { transactionId: first.tx.id, employeeId: diego, categoryId, description: "Almoço com cliente", costCenter: "4383" });

    const admin = listAdminExpenses(db, { employeeId: diego });
    expect(admin.find((e) => e.tx.id === first.tx.id)?.status).toBe("classificada");
    expect(admin.filter((e) => e.status === "ignorada").length).toBe(admin.length - 1);
  });

  it("não deixa classificar despesa de outro funcionário", () => {
    importBvk3(db, { fileName: "exemplo.txt", content: sample });
    advanceClock(db, 60);
    const [expense] = listEmployeeExpenses(db, employeeId(db, "Diego Rocha"));
    expect(() =>
      classifyExpense(db, {
        transactionId: expense.tx.id,
        employeeId: employeeId(db, "Ana Souza"),
        categoryId: 1,
        description: "x",
        costCenter: "",
      }),
    ).toThrow(/não é sua/);
  });

  it("parcela nova da mesma compra herda a classificação", () => {
    // Arquivo com a parcela 4/5 da compra BFSJP 35 (mesma compra, reference diferente)
    const parcel5 = sample.split(/\r?\n/).find((l) => l.includes("BFSJP 35"))!;
    importBvk3(db, { fileName: "exemplo.txt", content: sample });
    advanceClock(db, 60);
    const bruno = employeeId(db, "Bruno Lima");
    const expense = listEmployeeExpenses(db, bruno).find((e) => e.tx.merchant === "BFSJP 35")!;
    classifyExpense(db, { transactionId: expense.tx.id, employeeId: bruno, categoryId: expense.suggestedCategoryId ?? 1, description: "Uniforme", costCenter: "" });

    const parcel4 = parcel5.slice(0, 39) + "99999999999999999999999" + parcel5.slice(62, 74) + "00405" + parcel5.slice(79);
    const header = sample.split(/\r?\n/)[0];
    const holder = sample.split(/\r?\n/).find((l) => l.startsWith("1") && l.includes("PORTADOR 02"))!;
    const result = importBvk3(db, { fileName: "parcela.txt", content: [header, holder, parcel4].join("\r\n"), force: true });
    expect(result.newTransactions).toBe(1);
    const inherited = db.select().from(classifications).all().filter((c) => c.inheritedFromId !== null);
    expect(inherited).toHaveLength(1);
    expect(inherited[0].description).toBe("Uniforme");
  });

  it("prazo configurável", () => {
    setSetting(db, "deadline_hours", "24");
    importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const t = db.select().from(transactions).get()!;
    expect(new Date(t.dueAt).getTime() - new Date(t.availableAt).getTime()).toBe(24 * 3600 * 1000);
  });
});
