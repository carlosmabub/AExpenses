import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import { cards, categories, employees, expenses, transactions } from "@/db/schema";
import { ensureDemoUsers, seedIfEmpty } from "@/db/seed";
import { importBvk3 } from "@/lib/bvk3/import";
import { advanceClock, now, setClock } from "@/lib/clock";
import { createManualExpense, listAdminExpenses, listEmployeeExpenses, saveExpense } from "@/lib/expenses";
import { decodeBvk3 } from "@/lib/bvk3/parser";
import { expenseDeadline } from "@/lib/status";

const sample = decodeBvk3(readFileSync(path.join(__dirname, "fixtures/BVK3EXEMPLOMENSAL.txt")));
const RECEIPT = { receiptPath: "teste.jpg", receiptMime: "image/jpeg" };

async function employeeId(db: Db, name: string): Promise<number> {
  return (await db.select().from(employees).where(eq(employees.name, name)).get())!.id;
}

async function categoryId(db: Db, name: string): Promise<number> {
  return (await db.select().from(categories).where(eq(categories.name, name)).get())!.id;
}

describe("importação BVK3", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createDb(":memory:");
    await seedIfEmpty(db);
  });

  it("importa compras e saques como despesas, ignorando saldo/pagamento/ajuste", async () => {
    const result = await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    expect(result).toMatchObject({ imported: true, checkOk: true, newTransactions: 82, duplicateTransactions: 0, ignoredEntries: 17 });
    const rows = await db.select().from(expenses).all();
    expect(rows).toHaveLength(82);
    expect(rows.every((e) => e.source === "cartao" && e.paymentMethod === "cartao")).toBe(true);
    // o dono do cartão fica gravado na despesa (histórico fixo)
    const owners = new Map((await db.select().from(cards).all()).map((c) => [c.id, c.employeeId]));
    const txCard = new Map((await db.select().from(transactions).all()).map((t) => [t.id, t.cardId]));
    expect(rows.every((e) => e.employeeId === (owners.get(txCard.get(e.transactionId!)!) ?? null))).toBe(true);
    expect(rows.filter((e) => e.kind === "saque")).toHaveLength(4);
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
    expect(await db.select().from(expenses).all()).toHaveLength(82);
  });

  it("recusa arquivo divergente, a menos que forçado", async () => {
    const tampered = sample.replace("+00000000000301985", "+00000000000301986");
    expect((await importBvk3(db, { fileName: "x.txt", content: tampered })).imported).toBe(false);
    expect((await importBvk3(db, { fileName: "x.txt", content: tampered, force: true })).imported).toBe(true);
  });

  it("sugere o tipo pelo MCC", async () => {
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    await advanceClock(db, 60);
    const list = await listEmployeeExpenses(db, await employeeId(db, "Diego Rocha"));
    expect(list.find((e) => e.e.merchant === "AUTO POSTO DA TORRE")!.e.suggestedCategoryId).toBe(await categoryId(db, "Combustível"));
    expect(list.find((e) => e.e.merchant === "RANCHO COLONIAL")!.e.suggestedCategoryId).toBe(await categoryId(db, "Alimentação"));
  });

  it("simula o arquivo diário: a compra aparece em D+1 do lançamento", async () => {
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    expect((await now(db)).toISOString()).toMatch(/T11:00:00/);
    const diego = await employeeId(db, "Diego Rocha");
    const before = (await listEmployeeExpenses(db, diego)).length;
    await advanceClock(db, 20);
    const at = await now(db);
    const visible = await listEmployeeExpenses(db, diego);
    expect(visible.length).toBeGreaterThan(before);
    for (const e of visible) expect(new Date(e.e.availableAt).getTime()).toBeLessThanOrEqual(at.getTime());
  });
});

describe("piloto: todos os gastos num cartão só", () => {
  it("o Carlos recebe todas as compras do arquivo", async () => {
    const db = await createDb(":memory:");
    await seedIfEmpty(db);
    await ensureDemoUsers(db);
    const result = await importBvk3(db, { fileName: "exemplo.txt", content: sample, singleCardHolder: "CARLOS" });
    expect(result).toMatchObject({ imported: true, checkOk: true, newTransactions: 82, unlinkedCards: [] });
    const employeeCards = (await db.select().from(cards).all()).filter((c) => !c.isBillingAccount);
    expect(employeeCards).toHaveLength(1);
    expect(employeeCards[0]).toMatchObject({ holderName: "CARLOS", last4: "1000" });
    await advanceClock(db, 60);
    const carlos = await employeeId(db, "Carlos");
    const mine = await listEmployeeExpenses(db, carlos);
    expect(mine).toHaveLength(82);
    expect(new Set(mine.map((e) => e.e.city))).toEqual(new Set(["BEBEDOURO", "CAMPINAS", "SAO PAULO", "S JOSE R PRET", "BARRETOS", "RIO DE JANEIR", "SAO JOSE DO R"]));
  });
});

describe("piloto: datas trazidas para perto de hoje", () => {
  it("anda com as datas em semanas inteiras até ontem", async () => {
    const db = await createDb(":memory:");
    await seedIfEmpty(db);
    const today = new Date("2026-11-23T15:00:00Z");
    const result = await importBvk3(db, { fileName: "exemplo.txt", content: sample, shiftDatesTo: today });
    expect(result).toMatchObject({ imported: true, checkOk: true, newTransactions: 82 });
    const txs = await db.select().from(transactions).all();
    const lastPosting = txs.map((t) => t.postingDate!).sort().at(-1)!;
    expect(lastPosting <= "2026-11-22").toBe(true);
    expect(lastPosting > "2026-11-15").toBe(true);
    const mini = txs.find((t) => t.merchant === "MINI MERCADO BRASIL")!;
    expect(new Date(`${mini.purchaseDate}T12:00:00Z`).getUTCDay()).toBe(6); // sábado, como em 13/07/2013
    expect(Date.parse(mini.postingDate!) - Date.parse(mini.purchaseDate!)).toBe(2 * 86400000);
    expect((await now(db)).getUTCFullYear()).toBe(2026);
  });
});

describe("prazo: fim do mês da compra", () => {
  it("vence no último dia do mês às 23:59 de Brasília", () => {
    expect(expenseDeadline("2013-07-04", new Date("2013-07-06T11:00:00Z")).toISOString()).toBe("2013-08-01T02:59:59.000Z");
  });
  it("garante no mínimo 5 dias para compras do fim do mês", () => {
    expect(expenseDeadline("2013-07-30", new Date("2013-07-31T11:00:00Z")).toISOString()).toBe("2013-08-05T11:00:00.000Z");
  });

  it("o que não estiver num relatório enviado até o prazo vira ignorada", async () => {
    const db = await createDb(":memory:");
    await seedIfEmpty(db);
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    const diego = await employeeId(db, "Diego Rocha");
    await setClock(db, new Date("2013-07-25T12:00:00Z"));
    expect((await listEmployeeExpenses(db, diego)).every((e) => e.status === "sem_relatorio")).toBe(true);
    await setClock(db, new Date("2013-08-10T03:00:00Z"));
    expect((await listEmployeeExpenses(db, diego)).filter((e) => e.e.purchaseDate!.startsWith("2013-07")).every((e) => e.status === "ignorada")).toBe(true);
  });
});

describe("preenchimento da despesa", () => {
  let db: Db;
  let diego: number;
  beforeEach(async () => {
    db = await createDb(":memory:");
    await seedIfEmpty(db);
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    await setClock(db, new Date("2013-07-25T12:00:00Z"));
    diego = await employeeId(db, "Diego Rocha");
  });

  it("exige comprovante pela política do tipo de despesa", async () => {
    const [first] = await listEmployeeExpenses(db, diego);
    const input = { expenseId: first.e.id, employeeId: diego, categoryId: await categoryId(db, "Alimentação"), description: "Almoço com cliente", costCenter: "4383" };
    await expect(saveExpense(db, input)).rejects.toThrow(/anexar a foto do recibo para despesas do tipo Alimentação/);
    await saveExpense(db, { ...input, ...RECEIPT });
    const saved = (await listEmployeeExpenses(db, diego)).find((e) => e.e.id === first.e.id)!;
    expect(saved.e.savedAt).not.toBeNull();
    expect(saved.category?.name).toBe("Alimentação");
  });

  it("não deixa mexer em despesa de outro funcionário", async () => {
    const [first] = await listEmployeeExpenses(db, diego);
    await expect(
      saveExpense(db, { expenseId: first.e.id, employeeId: await employeeId(db, "Ana Souza"), categoryId: 1, description: "x", costCenter: "", ...RECEIPT }),
    ).rejects.toThrow(/não é sua/);
  });

  it("lança despesa manual em dinheiro", async () => {
    const id = await createManualExpense(db, {
      employeeId: diego,
      amountCents: 4500,
      purchaseDate: "2013-07-24",
      merchant: "Táxi do aeroporto",
      paymentMethod: "dinheiro",
      categoryId: await categoryId(db, "Transporte"),
      description: "Táxi até o cliente",
      costCenter: "4383",
      ...RECEIPT,
    });
    const manual = (await listEmployeeExpenses(db, diego)).find((e) => e.e.id === id)!;
    expect(manual.e).toMatchObject({ source: "manual", paymentMethod: "dinheiro", amountCents: 4500 });
    expect(manual.status).toBe("sem_relatorio");
  });

  it("despesa manual sem local e sem observação leva o nome do tipo", async () => {
    const id = await createManualExpense(db, {
      employeeId: diego,
      amountCents: 3200,
      purchaseDate: "2013-07-24",
      paymentMethod: "dinheiro",
      categoryId: await categoryId(db, "Alimentação"),
      description: "",
      costCenter: "4383",
      ...RECEIPT,
    });
    const manual = (await listEmployeeExpenses(db, diego)).find((e) => e.e.id === id)!;
    expect(manual.e).toMatchObject({ merchant: "Alimentação", description: "", amountCents: 3200 });
    expect(manual.e.savedAt).not.toBeNull();
  });

  it("parcela nova da mesma compra herda o preenchimento", async () => {
    const parcel5 = sample.split(/\r?\n/).find((l) => l.includes("BFSJP 35"))!;
    const bruno = await employeeId(db, "Bruno Lima");
    const expense = (await listEmployeeExpenses(db, bruno)).find((e) => e.e.merchant === "BFSJP 35")!;
    await saveExpense(db, { expenseId: expense.e.id, employeeId: bruno, categoryId: await categoryId(db, "EPIs"), description: "Uniforme", costCenter: "", ...RECEIPT });

    const parcel4 = parcel5.slice(0, 39) + "99999999999999999999999" + parcel5.slice(62, 74) + "00405" + parcel5.slice(79);
    const [header] = sample.split(/\r?\n/);
    const holder = sample.split(/\r?\n/).find((l) => l.startsWith("1") && l.includes("PORTADOR 02"))!;
    expect((await importBvk3(db, { fileName: "parcela.txt", content: [header, holder, parcel4].join("\r\n"), force: true })).newTransactions).toBe(1);
    const inherited = (await db.select().from(expenses).all()).filter((e) => e.inheritedFromId !== null);
    expect(inherited).toHaveLength(1);
    expect(inherited[0]).toMatchObject({ description: "Uniforme", receiptPath: "teste.jpg" });
  });
});

describe("cartão vinculado depois", () => {
  it("as compras passam para o funcionário vinculado", async () => {
    const db = await createDb(":memory:");
    await seedIfEmpty(db);
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    await advanceClock(db, 60);
    expect((await listAdminExpenses(db, { unlinked: true })).length).toBeGreaterThan(0);
    const card = (await db.select().from(cards).all()).find((c) => c.holderName === "NOME DO PORTADOR 09")!;
    const ana = await employeeId(db, "Ana Souza");
    await db.update(cards).set({ employeeId: ana }).where(eq(cards.id, card.id)).run();
    expect((await listAdminExpenses(db, { unlinked: true })).length).toBe(0);
    expect((await listEmployeeExpenses(db, ana)).length).toBeGreaterThan(0);
    expect(await db.select().from(transactions).all()).toHaveLength(82);
  });
});
