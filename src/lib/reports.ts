import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db, DbLike } from "@/db";
import { advances, employees, expenses, reports, type Advance, type Report } from "@/db/schema";
import { now } from "@/lib/clock";
import { canReview } from "@/lib/people";
import { ExpenseError, listExpensesOfReports, type ExpenseRow } from "@/lib/expenses";

import type { ReportStage } from "@/lib/status";

export interface ReportSummary {
  report: Report;
  owner: { id: number; name: string } | null;
  stage: ReportStage;
  expenses: ExpenseRow[];
  advances: Advance[];
  totalCents: number;
  advancedCents: number;
  /** Gasto pago com dinheiro de adiantamento */
  spentFromAdvanceCents: number;
  /** Positivo: o funcionário devolve à empresa. Negativo: a empresa deve ao funcionário. */
  advanceBalanceCents: number;
  /** Gasto em dinheiro do próprio bolso, que a empresa reembolsa */
  reimbursableCents: number;
  /** Despesas que ainda faltam preencher para enviar */
  incomplete: number;
}

function stageOf(report: Report, rows: ExpenseRow[]): ReportStage {
  if (report.status === "aberto") return "aberto";
  if (report.status === "aprovado") return "aprovado";
  return rows.some((r) => r.e.reviewStatus === "devolvida") ? "com_devolucao" : "em_aprovacao";
}

function build(report: Report, allRows: ExpenseRow[], adv: Advance[], owner: { id: number; name: string } | null): ReportSummary {
  const rows = allRows.filter((r) => r.e.kind !== "estorno");
  const sum = (list: ExpenseRow[]) => list.reduce((s, r) => s + r.e.amountCents, 0);
  const advancedCents = adv.reduce((s, a) => s + a.amountCents, 0);
  const spentFromAdvanceCents = sum(rows.filter((r) => r.e.paymentMethod === "adiantamento"));
  return {
    report,
    owner,
    stage: stageOf(report, rows),
    expenses: rows,
    advances: adv,
    totalCents: sum(rows),
    advancedCents,
    spentFromAdvanceCents,
    advanceBalanceCents: advancedCents - spentFromAdvanceCents,
    reimbursableCents: sum(rows.filter((r) => r.e.paymentMethod === "dinheiro")),
    incomplete: rows.filter((r) => !r.e.savedAt).length,
  };
}

/** Resumo de vários relatórios com três consultas no total (despesas, adiantamentos, donos). */
async function summarizeAll(db: DbLike, list: Report[]): Promise<ReportSummary[]> {
  if (!list.length) return [];
  const ids = list.map((r) => r.id);
  const ownerIds = [...new Set(list.map((r) => r.employeeId))];
  const [rows, adv, owners] = await Promise.all([
    listExpensesOfReports(db, ids),
    db.select().from(advances).where(inArray(advances.reportId, ids)).orderBy(asc(advances.date)).all(),
    db.select({ id: employees.id, name: employees.name }).from(employees).where(inArray(employees.id, ownerIds)).all(),
  ]);
  const ownerById = new Map(owners.map((o) => [o.id, o]));
  return list.map((report) =>
    build(
      report,
      rows.filter((r) => r.e.reportId === report.id),
      adv.filter((a) => a.reportId === report.id),
      ownerById.get(report.employeeId) ?? null,
    ),
  );
}

export async function summarize(db: DbLike, report: Report): Promise<ReportSummary> {
  return (await summarizeAll(db, [report]))[0];
}

export async function getReport(db: DbLike, reportId: number): Promise<ReportSummary | undefined> {
  const report = await db.select().from(reports).where(eq(reports.id, reportId)).get();
  return report ? summarize(db, report) : undefined;
}

export async function listEmployeeReports(db: DbLike, employeeId: number): Promise<ReportSummary[]> {
  const rows = await db.select().from(reports).where(eq(reports.employeeId, employeeId)).orderBy(desc(reports.id)).all();
  return summarizeAll(db, rows);
}

/** Relatórios enviados que o revisor pode analisar: o admin vê todos; o aprovador, os dos liderados. */
export async function listReportsForApproval(db: DbLike, reviewer: { id: number; role: string }): Promise<ReportSummary[]> {
  const conditions = [inArray(reports.status, ["enviado", "aprovado"])];
  if (reviewer.role !== "admin") {
    conditions.push(inArray(reports.employeeId, db.select({ id: employees.id }).from(employees).where(eq(employees.leaderId, reviewer.id))));
  }
  const rows = await db.select().from(reports).where(and(...conditions)).orderBy(desc(reports.submittedAt)).all();
  return summarizeAll(db, rows);
}

/** Adiantamentos do funcionário ainda não acertados em nenhum relatório. */
export async function openAdvances(db: DbLike, employeeId: number): Promise<Advance[]> {
  return db
    .select()
    .from(advances)
    .where(and(eq(advances.employeeId, employeeId), isNull(advances.reportId)))
    .orderBy(asc(advances.date))
    .all();
}

export interface ReportInput {
  employeeId: number;
  name: string;
  costCenter: string;
  notes: string;
  advanceIds: number[];
}

async function attachAdvances(db: DbLike, reportId: number, employeeId: number, advanceIds: number[]) {
  await db.update(advances).set({ reportId: null }).where(eq(advances.reportId, reportId)).run();
  if (!advanceIds.length) return;
  await db
    .update(advances)
    .set({ reportId })
    .where(and(inArray(advances.id, advanceIds), eq(advances.employeeId, employeeId), isNull(advances.reportId)))
    .run();
}

export async function createReport(db: Db, input: ReportInput): Promise<number> {
  const name = input.name.trim();
  if (!name) throw new ExpenseError("Dê um nome ao relatório.");
  return db.transaction(async (tx) => {
    const report = await tx
      .insert(reports)
      .values({ employeeId: input.employeeId, name, costCenter: input.costCenter.trim(), notes: input.notes.trim() })
      .returning({ id: reports.id })
      .get();
    await attachAdvances(tx, report.id, input.employeeId, input.advanceIds);
    return report.id;
  });
}

export async function updateReport(db: Db, reportId: number, input: ReportInput): Promise<void> {
  const report = await db.select().from(reports).where(eq(reports.id, reportId)).get();
  if (!report || report.employeeId !== input.employeeId) throw new ExpenseError("Relatório não encontrado.");
  if (report.status !== "aberto") throw new ExpenseError("O relatório já foi enviado e não pode ser alterado.");
  const name = input.name.trim();
  if (!name) throw new ExpenseError("Dê um nome ao relatório.");
  await db.transaction(async (tx) => {
    await tx.update(reports).set({ name, costCenter: input.costCenter.trim(), notes: input.notes.trim() }).where(eq(reports.id, reportId)).run();
    await attachAdvances(tx, reportId, input.employeeId, input.advanceIds);
  });
}

/** Envia para aprovação: precisa de despesas, todas preenchidas. */
export async function submitReport(db: Db, input: { reportId: number; employeeId: number }): Promise<void> {
  const summary = await getReport(db, input.reportId);
  if (!summary || summary.report.employeeId !== input.employeeId) throw new ExpenseError("Relatório não encontrado.");
  if (summary.report.status !== "aberto") throw new ExpenseError("Este relatório já foi enviado.");
  if (!summary.expenses.length) throw new ExpenseError("Adicione pelo menos uma despesa antes de enviar.");
  if (summary.incomplete) {
    throw new ExpenseError(`${summary.incomplete} despesa${summary.incomplete > 1 ? "s ainda precisam" : " ainda precisa"} de tipo e comprovante.`);
  }
  await db.update(reports).set({ status: "enviado", submittedAt: (await now(db)).toISOString() }).where(eq(reports.id, input.reportId)).run();
}

/** Aprovador aprova ou devolve uma despesa; o relatório fica aprovado quando todas forem aprovadas. */
export async function reviewExpense(
  db: Db,
  input: { expenseId: number; reviewerId: number; decision: "aprovada" | "devolvida"; comment: string },
): Promise<void> {
  const expense = await db.select().from(expenses).where(eq(expenses.id, input.expenseId)).get();
  if (!expense?.reportId) throw new ExpenseError("Despesa não encontrada.");
  const report = await db.select().from(reports).where(eq(reports.id, expense.reportId)).get();
  if (!report || report.status !== "enviado") throw new ExpenseError("O relatório não está aguardando aprovação.");
  const reviewer = await db.select().from(employees).where(eq(employees.id, input.reviewerId)).get();
  if (!reviewer || !reviewer.active || !(await canReview(db, reviewer, report.employeeId))) {
    throw new ExpenseError("Você não pode aprovar relatórios desta pessoa.");
  }
  if (expense.reviewStatus === "devolvida" && input.decision === "devolvida") throw new ExpenseError("A despesa já foi devolvida.");
  const comment = input.comment.trim();
  if (input.decision === "devolvida" && !comment) throw new ExpenseError("Diga ao funcionário o que corrigir.");
  const at = (await now(db)).toISOString();

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({ reviewStatus: input.decision, reviewComment: comment, reviewedAt: at, reviewedBy: input.reviewerId })
      .where(eq(expenses.id, expense.id))
      .run();
    const pending = await tx
      .select({ id: expenses.id, reviewStatus: expenses.reviewStatus, kind: expenses.kind })
      .from(expenses)
      .where(eq(expenses.reportId, report.id))
      .all();
    if (pending.filter((p) => p.kind !== "estorno").every((p) => p.reviewStatus === "aprovada")) {
      await tx.update(reports).set({ status: "aprovado", approvedAt: at }).where(eq(reports.id, report.id)).run();
    }
  });
}

/** Aprova de uma vez as despesas do relatório que ainda não foram analisadas. */
export async function approveRemaining(db: Db, input: { reportId: number; reviewerId: number }): Promise<void> {
  const rows = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.reportId, input.reportId), isNull(expenses.reviewStatus)))
    .all();
  for (const r of rows) await reviewExpense(db, { expenseId: r.id, reviewerId: input.reviewerId, decision: "aprovada", comment: "" });
}

export async function createAdvance(
  db: DbLike,
  input: { employeeId: number; amountCents: number; date: string; description: string; createdBy: number },
): Promise<void> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) throw new ExpenseError("Informe o valor do adiantamento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ExpenseError("Informe a data do adiantamento.");
  if (!input.description.trim()) throw new ExpenseError("Diga para que é o adiantamento.");
  await db
    .insert(advances)
    .values({ employeeId: input.employeeId, amountCents: Math.round(input.amountCents), date: input.date, description: input.description.trim(), createdBy: input.createdBy })
    .run();
}

export async function listAllAdvances(db: DbLike) {
  return db
    .select({ a: advances, employee: employees.name, report: reports.name, reportStatus: reports.status })
    .from(advances)
    .innerJoin(employees, eq(employees.id, advances.employeeId))
    .leftJoin(reports, eq(reports.id, advances.reportId))
    .orderBy(desc(advances.date), desc(advances.id))
    .all();
}


