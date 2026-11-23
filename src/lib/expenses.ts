import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Db, DbLike } from "@/db";
import { cards, categories, employees, expenses, reports, transactions, type Expense, type Transaction } from "@/db/schema";
import { now } from "@/lib/clock";
import { expenseDeadline, expenseStatus, type ExpenseStatus } from "@/lib/status";

export interface ExpenseRow {
  e: Expense;
  tx: Transaction | null;
  card: { id: number; last4: string; holderName: string; employeeId: number | null } | null;
  owner: { id: number; name: string; costCenter: string } | null;
  category: { id: number; name: string; icon: string } | null;
  report: { id: number; name: string; status: "aberto" | "enviado" | "aprovado" } | null;
  status: ExpenseStatus;
}

export class ExpenseError extends Error {}

/** Dono da despesa: o funcionário do cartão (compras do banco) ou quem lançou (manuais). */
export const ownerId = sql<number | null>`coalesce(${expenses.employeeId}, ${cards.employeeId})`;

function baseQuery(db: DbLike) {
  return db
    .select({
      e: expenses,
      tx: transactions,
      card: { id: cards.id, last4: cards.last4, holderName: cards.holderName, employeeId: cards.employeeId },
      owner: { id: employees.id, name: employees.name, costCenter: employees.costCenter },
      category: { id: categories.id, name: categories.name, icon: categories.icon },
      report: { id: reports.id, name: reports.name, status: reports.status },
    })
    .from(expenses)
    .leftJoin(transactions, eq(transactions.id, expenses.transactionId))
    .leftJoin(cards, eq(cards.id, transactions.cardId))
    .leftJoin(employees, eq(employees.id, ownerId))
    .leftJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(reports, eq(reports.id, expenses.reportId));
}

type BaseRow = Awaited<ReturnType<ReturnType<typeof baseQuery>["all"]>>[number];

export function toRow(r: BaseRow, at: Date): ExpenseRow {
  return {
    e: r.e,
    tx: r.tx,
    card: r.card?.id ? r.card : null,
    owner: r.owner?.id ? r.owner : null,
    category: r.category?.id ? r.category : null,
    report: r.report?.id ? r.report : null,
    status: expenseStatus({ kind: r.e.kind, dueAt: r.e.dueAt, reviewStatus: r.e.reviewStatus, reportStatus: r.report?.status }, at),
  };
}

const newestFirst = [desc(expenses.purchaseDate), desc(expenses.id)];

/** Despesas que o funcionário já pode ver (as do cartão chegam com o "arquivo diário"). */
export async function listEmployeeExpenses(db: DbLike, employeeId: number): Promise<ExpenseRow[]> {
  const at = await now(db);
  const rows = await baseQuery(db)
    .where(and(eq(ownerId, employeeId), lte(expenses.availableAt, at.toISOString())))
    .orderBy(...newestFirst)
    .all();
  return rows.map((r) => toRow(r, at));
}

export async function listReportExpenses(db: DbLike, reportId: number): Promise<ExpenseRow[]> {
  const at = await now(db);
  const rows = await baseQuery(db).where(eq(expenses.reportId, reportId)).orderBy(asc(expenses.purchaseDate), asc(expenses.id)).all();
  return rows.map((r) => toRow(r, at));
}

export async function getExpense(db: DbLike, expenseId: number): Promise<ExpenseRow | undefined> {
  const r = await baseQuery(db).where(eq(expenses.id, expenseId)).get();
  return r ? toRow(r, await now(db)) : undefined;
}

export interface AdminFilters {
  employeeId?: number;
  status?: ExpenseStatus;
  categoryId?: number;
  unlinked?: boolean;
  from?: string;
  to?: string;
}

/** Tudo o que já chegou, para o admin (o filtro de status é aplicado depois do cálculo). */
export async function listAdminExpenses(db: DbLike, filters: AdminFilters = {}): Promise<ExpenseRow[]> {
  const at = await now(db);
  const conditions = [lte(expenses.availableAt, at.toISOString())];
  if (filters.employeeId) conditions.push(eq(ownerId, filters.employeeId));
  if (filters.unlinked) conditions.push(isNull(ownerId));
  if (filters.categoryId) conditions.push(eq(expenses.categoryId, filters.categoryId));
  const rows = await baseQuery(db).where(and(...conditions)).orderBy(...newestFirst).all();
  return rows
    .map((r) => toRow(r, at))
    .filter((r) => !filters.status || r.status === filters.status)
    .filter((r) => (!filters.from || (r.e.purchaseDate ?? "") >= filters.from) && (!filters.to || (r.e.purchaseDate ?? "") <= filters.to));
}

export async function listCategories(db: DbLike, onlyActive = true) {
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)).all();
  return onlyActive ? rows.filter((c) => c.active) : rows;
}

/** Relatórios abertos do funcionário: os únicos que recebem despesas. */
export async function openReports(db: DbLike, employeeId: number) {
  return db
    .select()
    .from(reports)
    .where(and(eq(reports.employeeId, employeeId), eq(reports.status, "aberto")))
    .orderBy(desc(reports.id))
    .all();
}

interface ReceiptInput {
  receiptPath?: string | null;
  receiptMime?: string | null;
}

async function validateCommon(
  db: DbLike,
  input: { employeeId: number; categoryId: number; description: string; reportId?: number | null; hasReceipt: boolean },
) {
  const category = await db.select().from(categories).where(eq(categories.id, input.categoryId)).get();
  if (!category || !category.active) throw new ExpenseError("Escolha o tipo da despesa.");
  if (category.requiresReceipt && !input.hasReceipt) {
    throw new ExpenseError(`Política de despesa: é necessário anexar a foto do recibo para despesas do tipo ${category.name}.`);
  }
  if (input.reportId) {
    const report = await db.select().from(reports).where(eq(reports.id, input.reportId)).get();
    if (!report || report.employeeId !== input.employeeId) throw new ExpenseError("Relatório não encontrado.");
    if (report.status !== "aberto") throw new ExpenseError("Esse relatório já foi enviado; escolha um relatório aberto.");
  }
  return category;
}

export interface SaveExpenseInput extends ReceiptInput {
  expenseId: number;
  employeeId: number;
  categoryId: number;
  description: string;
  costCenter: string;
  /** undefined mantém o relatório atual; null tira do relatório */
  reportId?: number | null;
}

/**
 * Salva o preenchimento de uma despesa. As outras parcelas da mesma compra ainda não
 * preenchidas recebem o mesmo tipo, descrição, centro de custo e comprovante.
 */
export async function saveExpense(db: Db, input: SaveExpenseInput): Promise<void> {
  const row = await getExpense(db, input.expenseId);
  if (!row) throw new ExpenseError("Despesa não encontrada.");
  if (row.owner?.id !== input.employeeId) throw new ExpenseError("Esta despesa não é sua.");
  if (row.e.kind === "estorno") throw new ExpenseError("Estornos não precisam de preenchimento.");
  const at = await now(db);
  if (new Date(row.e.availableAt).getTime() > at.getTime()) throw new ExpenseError("Despesa ainda não disponível.");
  if (row.status === "em_aprovacao" || row.status === "aprovada") throw new ExpenseError("Esta despesa está com o aprovador e não pode ser alterada.");

  const devolvida = row.status === "devolvida";
  // Despesa devolvida continua no relatório dela; as outras podem mudar de relatório
  const reportId = devolvida ? row.e.reportId : input.reportId === undefined ? row.e.reportId : input.reportId;
  await validateCommon(db, {
    employeeId: input.employeeId,
    categoryId: input.categoryId,
    description: input.description,
    reportId: devolvida ? null : reportId,
    hasReceipt: !!(input.receiptPath ?? row.e.receiptPath),
  });

  const values = {
    categoryId: input.categoryId,
    description: input.description.trim(),
    costCenter: input.costCenter.trim(),
    reportId,
    savedAt: at.toISOString(),
    inheritedFromId: null,
    ...(input.receiptPath ? { receiptPath: input.receiptPath, receiptMime: input.receiptMime ?? null } : {}),
    // Corrigida pelo funcionário: volta para o aprovador
    ...(devolvida ? { reviewStatus: null, reviewedAt: null } : {}),
  };

  await db.transaction(async (tx) => {
    const saved = await tx.update(expenses).set(values).where(eq(expenses.id, row.e.id)).returning().get();
    if (!row.tx || row.tx.installmentsTotal < 2) return;
    const siblings = await tx
      .select({ id: expenses.id })
      .from(expenses)
      .innerJoin(transactions, eq(transactions.id, expenses.transactionId))
      .where(and(eq(transactions.groupKey, row.tx.groupKey), isNull(expenses.savedAt)))
      .all();
    const ids = siblings.map((s) => s.id).filter((id) => id !== row.e.id);
    if (!ids.length) return;
    await tx
      .update(expenses)
      .set({
        categoryId: saved.categoryId,
        description: saved.description,
        costCenter: saved.costCenter,
        receiptPath: saved.receiptPath,
        receiptMime: saved.receiptMime,
        savedAt: saved.savedAt,
        inheritedFromId: saved.id,
      })
      .where(inArray(expenses.id, ids))
      .run();
  });
}

export interface ManualExpenseInput extends ReceiptInput {
  employeeId: number;
  amountCents: number;
  purchaseDate: string;
  /** Onde foi; quando vazio, a despesa leva o nome do tipo */
  merchant?: string;
  paymentMethod: "dinheiro" | "adiantamento";
  categoryId: number;
  description: string;
  costCenter: string;
  reportId?: number | null;
}

/** Despesa paga fora do cartão (dinheiro do funcionário ou de um adiantamento). */
export async function createManualExpense(db: Db, input: ManualExpenseInput): Promise<number> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) throw new ExpenseError("Informe o valor da despesa.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.purchaseDate)) throw new ExpenseError("Informe a data da despesa.");
  if (input.paymentMethod !== "dinheiro" && input.paymentMethod !== "adiantamento") throw new ExpenseError("Escolha a forma de pagamento.");
  const at = await now(db);
  if (input.purchaseDate > at.toISOString().slice(0, 10)) throw new ExpenseError("A data não pode ser no futuro.");
  const category = await validateCommon(db, { ...input, hasReceipt: !!input.receiptPath });

  const created = await db
    .insert(expenses)
    .values({
      employeeId: input.employeeId,
      source: "manual",
      kind: "compra",
      paymentMethod: input.paymentMethod,
      amountCents: Math.round(input.amountCents),
      purchaseDate: input.purchaseDate,
      merchant: input.merchant?.trim() || category.name,
      categoryId: input.categoryId,
      description: input.description.trim(),
      costCenter: input.costCenter.trim(),
      receiptPath: input.receiptPath ?? null,
      receiptMime: input.receiptMime ?? null,
      reportId: input.reportId ?? null,
      savedAt: at.toISOString(),
      availableAt: at.toISOString(),
      dueAt: expenseDeadline(input.purchaseDate, at).toISOString(),
    })
    .returning({ id: expenses.id })
    .get();
  return created.id;
}

/** Lança as despesas num relatório aberto (ou tira, com reportId null). */
export async function moveExpensesToReport(db: Db, input: { employeeId: number; expenseIds: number[]; reportId: number | null }): Promise<number> {
  if (input.reportId) {
    const report = await db.select().from(reports).where(eq(reports.id, input.reportId)).get();
    if (!report || report.employeeId !== input.employeeId) throw new ExpenseError("Relatório não encontrado.");
    if (report.status !== "aberto") throw new ExpenseError("Esse relatório já foi enviado.");
  }
  const rows = await Promise.all(input.expenseIds.map((id) => getExpense(db, id)));
  const movable = rows.filter(
    (r): r is ExpenseRow =>
      !!r && r.owner?.id === input.employeeId && r.e.kind !== "estorno" && ["sem_relatorio", "em_relatorio", "ignorada"].includes(r.status),
  );
  if (!movable.length) return 0;
  await db
    .update(expenses)
    .set({ reportId: input.reportId })
    .where(
      and(
        inArray(
          expenses.id,
          movable.map((r) => r.e.id),
        ),
        or(isNull(expenses.reviewStatus), eq(expenses.reviewStatus, "devolvida")),
      ),
    )
    .run();
  return movable.length;
}
