import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import { categories, employees } from "@/db/schema";
import { seedIfEmpty } from "@/db/seed";
import { importBvk3 } from "@/lib/bvk3/import";
import { setClock } from "@/lib/clock";
import { createManualExpense, getExpense, listEmployeeExpenses, moveExpensesToReport, saveExpense } from "@/lib/expenses";
import { decodeBvk3 } from "@/lib/bvk3/parser";
import { approveRemaining, createAdvance, createReport, getReport, openAdvances, reviewExpense, submitReport } from "@/lib/reports";

const sample = decodeBvk3(readFileSync(path.join(__dirname, "fixtures/BVK3EXEMPLOMENSAL.txt")));
const RECEIPT = { receiptPath: "teste.jpg", receiptMime: "image/jpeg" };

describe("relatórios, aprovação e adiantamentos", () => {
  let db: Db;
  let diego: number;
  let admin: number;
  let alimentacao: number;

  async function fillAll(ids: number[]) {
    for (const id of ids) {
      await saveExpense(db, { expenseId: id, employeeId: diego, categoryId: alimentacao, description: "Visita técnica", costCenter: "4383", ...RECEIPT });
    }
  }

  beforeEach(async () => {
    db = await createDb(":memory:");
    await seedIfEmpty(db);
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    await setClock(db, new Date("2013-07-25T12:00:00Z"));
    diego = (await db.select().from(employees).where(eq(employees.name, "Diego Rocha")).get())!.id;
    admin = (await db.select().from(employees).where(eq(employees.role, "admin")).get())!.id;
    alimentacao = (await db.select().from(categories).where(eq(categories.name, "Alimentação")).get())!.id;
  });

  it("monta, envia, devolve uma despesa, corrige e aprova", async () => {
    const reportId = await createReport(db, { employeeId: diego, name: "Visita Campinas", costCenter: "4383", notes: "", advanceIds: [] });
    const ids = (await listEmployeeExpenses(db, diego)).slice(0, 3).map((e) => e.e.id);
    expect(await moveExpensesToReport(db, { employeeId: diego, expenseIds: ids, reportId })).toBe(3);
    expect((await getExpense(db, ids[0]))!.status).toBe("em_relatorio");

    await expect(submitReport(db, { reportId, employeeId: diego })).rejects.toThrow(/precisam de tipo e comprovante/);
    await fillAll(ids);
    await submitReport(db, { reportId, employeeId: diego });
    expect((await getReport(db, reportId))!.stage).toBe("em_aprovacao");
    expect((await getExpense(db, ids[0]))!.status).toBe("em_aprovacao");

    // devolver exige comentário e afeta só aquela despesa
    await expect(reviewExpense(db, { expenseId: ids[0], reviewerId: admin, decision: "devolvida", comment: " " })).rejects.toThrow(/o que corrigir/);
    await reviewExpense(db, { expenseId: ids[0], reviewerId: admin, decision: "devolvida", comment: "Falta a nota fiscal" });
    await reviewExpense(db, { expenseId: ids[1], reviewerId: admin, decision: "aprovada", comment: "" });
    expect((await getReport(db, reportId))!.stage).toBe("com_devolucao");
    expect((await getExpense(db, ids[0]))!.status).toBe("devolvida");
    expect((await getExpense(db, ids[1]))!.status).toBe("aprovada");

    // funcionário corrige: volta para o aprovador, no mesmo relatório
    await saveExpense(db, { expenseId: ids[0], employeeId: diego, categoryId: alimentacao, description: "Almoço, nota anexada", costCenter: "4383", receiptPath: "nf.jpg" });
    const fixed = (await getExpense(db, ids[0]))!;
    expect(fixed.status).toBe("em_aprovacao");
    expect(fixed.e.reportId).toBe(reportId);

    await approveRemaining(db, { reportId, reviewerId: admin });
    expect((await getReport(db, reportId))!.stage).toBe("aprovado");
  });

  it("despesa num relatório enviado não vira ignorada depois do prazo", async () => {
    const reportId = await createReport(db, { employeeId: diego, name: "Julho", costCenter: "", notes: "", advanceIds: [] });
    const ids = (await listEmployeeExpenses(db, diego)).slice(0, 1).map((e) => e.e.id);
    await moveExpensesToReport(db, { employeeId: diego, expenseIds: ids, reportId });
    await fillAll(ids);
    await submitReport(db, { reportId, employeeId: diego });
    await setClock(db, new Date("2013-08-15T12:00:00Z"));
    expect((await getExpense(db, ids[0]))!.status).toBe("em_aprovacao");
  });

  it("não aceita despesa num relatório já enviado", async () => {
    const reportId = await createReport(db, { employeeId: diego, name: "Julho", costCenter: "", notes: "", advanceIds: [] });
    const [a, b] = (await listEmployeeExpenses(db, diego)).map((e) => e.e.id);
    await moveExpensesToReport(db, { employeeId: diego, expenseIds: [a], reportId });
    await fillAll([a]);
    await submitReport(db, { reportId, employeeId: diego });
    await expect(moveExpensesToReport(db, { employeeId: diego, expenseIds: [b], reportId })).rejects.toThrow(/já foi enviado/);
  });

  it("acerta o adiantamento: o que sobrou volta para a empresa", async () => {
    await createAdvance(db, { employeeId: diego, amountCents: 50000, date: "2013-07-20", description: "Viagem a Campinas", createdBy: admin });
    const [advance] = await openAdvances(db, diego);
    const reportId = await createReport(db, { employeeId: diego, name: "Campinas", costCenter: "4383", notes: "", advanceIds: [advance.id] });
    expect(await openAdvances(db, diego)).toHaveLength(0);

    for (const [merchant, cents] of [["Hotel Central", 30000], ["Restaurante", 12000]] as const) {
      await createManualExpense(db, {
        employeeId: diego, amountCents: cents, purchaseDate: "2013-07-22", merchant, paymentMethod: "adiantamento",
        categoryId: alimentacao, description: merchant, costCenter: "4383", reportId, ...RECEIPT,
      });
    }
    const summary = (await getReport(db, reportId))!;
    expect(summary).toMatchObject({ advancedCents: 50000, spentFromAdvanceCents: 42000, advanceBalanceCents: 8000, totalCents: 42000 });
  });
});
