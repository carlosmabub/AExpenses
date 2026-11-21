import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import type { Db, DbLike } from "@/db";
import { cards, categories, classifications, employees, transactions, type Classification, type Transaction } from "@/db/schema";
import { now } from "@/lib/clock";
import { expenseStatus, type ExpenseStatus } from "@/lib/status";

export interface ExpenseRow {
  tx: Transaction;
  classification: Classification | null;
  card: { id: number; last4: string; holderName: string; employeeId: number | null };
  employee: { id: number; name: string; costCenter: string } | null;
  category: { id: number; name: string; icon: string } | null;
  suggestedCategoryId: number | null;
  status: ExpenseStatus;
}

function baseQuery(db: DbLike) {
  return db
    .select({
      tx: transactions,
      classification: classifications,
      card: { id: cards.id, last4: cards.last4, holderName: cards.holderName, employeeId: cards.employeeId },
      employee: { id: employees.id, name: employees.name, costCenter: employees.costCenter },
      category: { id: categories.id, name: categories.name, icon: categories.icon },
    })
    .from(transactions)
    .innerJoin(cards, eq(cards.id, transactions.cardId))
    .leftJoin(employees, eq(employees.id, cards.employeeId))
    .leftJoin(classifications, eq(classifications.transactionId, transactions.id))
    .leftJoin(categories, eq(categories.id, classifications.categoryId));
}

type BaseRow = Awaited<ReturnType<ReturnType<typeof baseQuery>["all"]>>[number];

function toRow(r: BaseRow, at: Date): ExpenseRow {
  return {
    tx: r.tx,
    classification: r.classification,
    card: r.card,
    employee: r.employee?.id ? r.employee : null,
    category: r.category?.id ? r.category : null,
    suggestedCategoryId: r.tx.suggestedCategoryId,
    status: expenseStatus({ kind: r.tx.kind, dueAt: r.tx.dueAt, classifiedAt: r.classification?.classifiedAt }, at),
  };
}

/** Despesas que o funcionário já pode ver (chegaram no "arquivo diário"). */
export function listEmployeeExpenses(db: DbLike, employeeId: number): ExpenseRow[] {
  const at = now(db);
  return baseQuery(db)
    .where(and(eq(cards.employeeId, employeeId), lte(transactions.availableAt, at.toISOString())))
    .orderBy(desc(transactions.purchaseDate), desc(transactions.id))
    .all()
    .map((r) => toRow(r, at));
}

export function getExpense(db: DbLike, transactionId: number): ExpenseRow | undefined {
  const r = baseQuery(db).where(eq(transactions.id, transactionId)).get();
  return r ? toRow(r, now(db)) : undefined;
}

export interface AdminFilters {
  employeeId?: number;
  status?: ExpenseStatus;
  categoryId?: number;
  unlinked?: boolean;
  from?: string;
  to?: string;
}

/** Tudo o que já chegou, para o admin (filtros de status são aplicados após o cálculo). */
export function listAdminExpenses(db: DbLike, filters: AdminFilters = {}): ExpenseRow[] {
  const at = now(db);
  const conditions = [lte(transactions.availableAt, at.toISOString())];
  if (filters.employeeId) conditions.push(eq(cards.employeeId, filters.employeeId));
  if (filters.unlinked) conditions.push(isNull(cards.employeeId));
  if (filters.categoryId) conditions.push(eq(classifications.categoryId, filters.categoryId));
  return baseQuery(db)
    .where(and(...conditions))
    .orderBy(desc(transactions.purchaseDate), desc(transactions.id))
    .all()
    .map((r) => toRow(r, at))
    .filter((r) => !filters.status || r.status === filters.status)
    .filter((r) => (!filters.from || (r.tx.purchaseDate ?? "") >= filters.from) && (!filters.to || (r.tx.purchaseDate ?? "") <= filters.to));
}

export interface ClassifyInput {
  transactionId: number;
  employeeId: number;
  categoryId: number;
  description: string;
  costCenter: string;
  receiptPath?: string | null;
  receiptMime?: string | null;
}

export class ExpenseError extends Error {}

/**
 * Grava a justificativa do funcionário. As outras parcelas da mesma compra
 * que ainda não foram classificadas recebem a mesma classificação.
 */
export function classifyExpense(db: Db, input: ClassifyInput): void {
  const expense = getExpense(db, input.transactionId);
  if (!expense) throw new ExpenseError("Despesa não encontrada.");
  if (expense.card.employeeId !== input.employeeId) throw new ExpenseError("Esta despesa não é sua.");
  if (expense.tx.kind === "estorno") throw new ExpenseError("Estornos não precisam de classificação.");
  if (new Date(expense.tx.availableAt).getTime() > now(db).getTime()) throw new ExpenseError("Despesa ainda não disponível.");
  const description = input.description.trim();
  if (!description) throw new ExpenseError("Descreva do que se trata a despesa.");
  const category = db.select().from(categories).where(eq(categories.id, input.categoryId)).get();
  if (!category || !category.active) throw new ExpenseError("Escolha uma categoria válida.");

  const values = {
    categoryId: category.id,
    description,
    costCenter: input.costCenter.trim(),
    classifiedBy: input.employeeId,
    classifiedAt: now(db).toISOString(),
    inheritedFromId: null,
    ...(input.receiptPath !== undefined ? { receiptPath: input.receiptPath, receiptMime: input.receiptMime ?? null } : {}),
  };

  db.transaction((tx) => {
    const saved = tx
      .insert(classifications)
      .values({ transactionId: expense.tx.id, ...values })
      .onConflictDoUpdate({ target: classifications.transactionId, set: values })
      .returning()
      .get();

    const siblings = tx
      .select({ id: transactions.id })
      .from(transactions)
      .leftJoin(classifications, eq(classifications.transactionId, transactions.id))
      .where(and(eq(transactions.groupKey, expense.tx.groupKey), isNull(classifications.id)))
      .all();
    for (const s of siblings) {
      if (s.id === expense.tx.id) continue;
      tx.insert(classifications)
        .values({ ...values, receiptPath: saved.receiptPath, receiptMime: saved.receiptMime, transactionId: s.id, inheritedFromId: saved.id })
        .run();
    }
  });
}

export function listCategories(db: DbLike, onlyActive = true) {
  const rows = db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)).all();
  return onlyActive ? rows.filter((c) => c.active) : rows;
}
