import { and, eq, inArray, isNotNull, isNull, like, sql } from "drizzle-orm";
import type { Db, DbLike } from "@/db";
import { cards, categories, employees, expenses, importBatches, transactions } from "@/db/schema";
import { cardFingerprint, cardLast4 } from "@/lib/card-fingerprint";
import { clockMode, dailyFileAvailability, now, setClock, simulatedNow } from "@/lib/clock";
import { expenseDeadline } from "@/lib/status";
import { normalizeMcc, suggestCategory } from "@/lib/mcc";
import { checkBvk3, parseBvk3 } from "./parser";
import { entryKind } from "./codes";

export interface ImportOptions {
  fileName: string;
  content: string;
  importedBy?: number;
  /** Importa mesmo que a conferência com o trailer falhe */
  force?: boolean;
  /**
   * Piloto: junta todos os cartões do arquivo (menos a conta da empresa) num cartão só,
   * com este nome de portador, para um usuário de demonstração ver todos os gastos.
   */
  singleCardHolder?: string;
  /**
   * Piloto: anda com todas as datas do arquivo em semanas inteiras até a última data de
   * lançamento cair em ontem (em relação a esta data) ou pouco antes. Mantém intervalos e dias da semana.
   */
  shiftDatesTo?: Date;
}

export interface ImportResult {
  imported: boolean;
  batchId?: number;
  checkOk: boolean;
  problems: string[];
  newTransactions: number;
  duplicateTransactions: number;
  ignoredEntries: number;
  newCards: number;
  unlinkedCards: string[];
  totalCents: number;
}

/** Linhas por INSERT (o banco remoto cobra uma ida e volta por comando) */
const INSERT_CHUNK = 50;

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

export async function importBvk3(db: Db, options: ImportOptions): Promise<ImportResult> {
  const file = parseBvk3(options.content);
  const check = checkBvk3(file);
  const base: ImportResult = {
    imported: false,
    checkOk: check.ok,
    problems: check.problems,
    newTransactions: 0,
    duplicateTransactions: 0,
    ignoredEntries: 0,
    newCards: 0,
    unlinkedCards: [],
    totalCents: check.totalBrlCents,
  };
  if (!check.ok && !options.force) return base;

  const simulated = (await clockMode(db)) === "simulado";
  const importTime = await now(db);
  const activeCategories = await db.select().from(categories).all();
  const employeesByHolder = new Map(
    (await db.select().from(employees).all())
      .filter((e) => e.cardHolderName)
      .map((e) => [normalizeName(e.cardHolderName), e.id]),
  );
  const companyName = normalizeName(file.header?.companyName ?? "");
  // A conferência acima vale sobre o arquivo como veio; o remapeamento do piloto vem depois
  if (options.singleCardHolder) mergeCards(file, companyName, options.singleCardHolder);
  if (options.shiftDatesTo) shiftFileDates(file, weeksUntil(file, options.shiftDatesTo));

  return db.transaction(async (tx) => {
    const batch = await tx
      .insert(importBatches)
      .values({
        fileName: options.fileName,
        companyName: file.header?.companyName ?? "",
        processingDate: file.header?.processingDate ?? null,
        dueDate: file.header?.dueDate ?? null,
        trailerTransactions: file.trailer?.transactions ?? null,
        trailerTotalCents: file.trailer?.totalBrlCents ?? null,
        readEntries: file.entries.length,
        readTotalCents: check.totalBrlCents,
        checkOk: check.ok,
        problems: JSON.stringify(check.problems),
        newTransactions: 0,
        duplicateTransactions: 0,
        ignoredEntries: 0,
        simulated,
        importedBy: options.importedBy ?? null,
      })
      .returning({ id: importBatches.id })
      .get();

    // Cartões: identificados pela impressão digital, nunca pelo número completo
    const fingerprints = new Map(file.cards.map((c) => [c.cardNumber, cardFingerprint(c.cardNumber)]));
    const existing = new Map(
      (await tx.select().from(cards).where(inArray(cards.fingerprint, [...new Set(fingerprints.values())])).all()).map((c) => [c.fingerprint, c]),
    );
    const cardIds = new Map<string, number>();
    // Dono do cartão no momento da importação: fica gravado na despesa (histórico fixo)
    const cardOwner = new Map<number, number | null>();
    for (const card of file.cards) {
      const fingerprint = fingerprints.get(card.cardNumber)!;
      let row = existing.get(fingerprint);
      if (!row) {
        // O registro da conta da empresa traz o nome dela no campo do portador
        const isBillingAccount = !!companyName && normalizeName(card.holderName).startsWith(companyName);
        // Cartão digitado no cadastro antes do arquivo chegar: o arquivo completa o registro reservado
        const reserved = isBillingAccount
          ? undefined
          : await tx.select().from(cards).where(and(like(cards.fingerprint, "pending:%"), eq(cards.last4, cardLast4(card.cardNumber)))).get();
        row = reserved
          ? await tx.update(cards).set({ fingerprint, holderName: card.holderName, bankCostCenter: card.costCenter }).where(eq(cards.id, reserved.id)).returning().get()
          : await tx
          .insert(cards)
          .values({
            fingerprint,
            last4: cardLast4(card.cardNumber),
            holderName: card.holderName,
            bankCostCenter: card.costCenter,
            isBillingAccount,
            employeeId: isBillingAccount ? null : (employeesByHolder.get(normalizeName(card.holderName)) ?? null),
          })
          .returning()
          .get();
        existing.set(fingerprint, row);
        base.newCards++;
      }
      cardIds.set(card.cardNumber, row.id);
      cardOwner.set(row.id, row.employeeId);
      if (!row.employeeId && !row.isBillingAccount) base.unlinkedCards.push(`${row.holderName} (final ${row.last4})`);
    }

    const rows: (typeof transactions.$inferInsert)[] = [];
    for (const entry of file.entries) {
      const kind = entryKind(entry);
      const cardId = cardIds.get(entry.cardNumber);
      if (kind === "ignorado" || !cardId) {
        base.ignoredEntries++;
        continue;
      }
      const availableAt = simulated && entry.postingDate ? dailyFileAvailability(entry.postingDate) : importTime;
      const suggested = kind === "compra" || kind === "saque" ? suggestCategory(activeCategories, entry.mcc) : undefined;
      rows.push({
        batchId: batch.id,
        cardId,
        reference: entry.reference,
        kind,
        transactionCode: entry.transactionCode,
        purchaseDate: entry.purchaseDate,
        postingDate: entry.postingDate,
        installment: entry.installment,
        installmentsTotal: entry.installmentsTotal,
        groupKey:
          entry.installmentsTotal > 1
            ? `${cardId}|${entry.purchaseDate}|${entry.description}|${entry.installmentsTotal}`
            : `${cardId}|${entry.reference}|${kind}`,
        amountCents: entry.amountCents,
        originalAmountMillis: entry.originalAmountMillis,
        originalCurrency: entry.originalCurrency,
        merchant: entry.description,
        merchantCnpj: entry.merchantCnpj,
        city: entry.city,
        state: entry.state,
        mcc: normalizeMcc(entry.mcc),
        activityDescription: entry.activityDescription,
        authorizationCode: entry.authorizationCode,
        suggestedCategoryId: suggested?.id ?? null,
        availableAt: availableAt.toISOString(),
        dueAt: expenseDeadline(entry.purchaseDate, availableAt).toISOString(),
      });
    }

    const inserted: (typeof transactions.$inferSelect)[] = [];
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      inserted.push(
        ...(await tx
          .insert(transactions)
          .values(rows.slice(i, i + INSERT_CHUNK))
          .onConflictDoNothing()
          .returning()
          .all()),
      );
    }
    const insertedIds = inserted.map((t) => t.id);
    base.newTransactions = inserted.length;
    base.duplicateTransactions = rows.length - inserted.length;

    // Cada compra nova vira uma despesa do dono do cartão
    const expenseRows = inserted.map((t) => ({
      transactionId: t.id,
      employeeId: cardOwner.get(t.cardId) ?? null,
      source: "cartao" as const,
      kind: t.kind,
      paymentMethod: "cartao" as const,
      amountCents: t.amountCents,
      purchaseDate: t.purchaseDate,
      merchant: t.merchant,
      city: t.city,
      suggestedCategoryId: t.suggestedCategoryId,
      availableAt: t.availableAt,
      dueAt: t.dueAt,
    }));
    for (let i = 0; i < expenseRows.length; i += INSERT_CHUNK) {
      await tx.insert(expenses).values(expenseRows.slice(i, i + INSERT_CHUNK)).run();
    }

    // Parcelas novas de compras já preenchidas herdam o preenchimento
    if (insertedIds.length) await inheritGroupExpenses(tx, insertedIds);

    await tx
      .update(importBatches)
      .set({
        newTransactions: base.newTransactions,
        duplicateTransactions: base.duplicateTransactions,
        ignoredEntries: base.ignoredEntries,
      })
      .where(eq(importBatches.id, batch.id))
      .run();

    // No modo simulado, o relógio começa na chegada do primeiro "arquivo diário"
    if (simulated && !(await simulatedNow(tx)) && insertedIds.length) {
      const first = await tx
        .select({ at: sql<string>`min(${transactions.availableAt})` })
        .from(transactions)
        .get();
      if (first?.at) await setClock(tx, new Date(first.at));
    }

    return { ...base, imported: true, batchId: batch.id };
  });
}

async function inheritGroupExpenses(db: DbLike, transactionIds: number[]): Promise<void> {
  const fresh = await db
    .select({ expenseId: expenses.id, groupKey: transactions.groupKey })
    .from(expenses)
    .innerJoin(transactions, eq(transactions.id, expenses.transactionId))
    .where(inArray(transactions.id, transactionIds))
    .all();
  const groupKeys = [...new Set(fresh.map((t) => t.groupKey))];
  const sources = await db
    .select({ e: expenses, groupKey: transactions.groupKey })
    .from(expenses)
    .innerJoin(transactions, eq(transactions.id, expenses.transactionId))
    .where(and(inArray(transactions.groupKey, groupKeys), isNotNull(expenses.savedAt), isNull(expenses.inheritedFromId)))
    .all();
  const byGroup = new Map(sources.map((s) => [s.groupKey, s.e]));
  for (const f of fresh) {
    const source = byGroup.get(f.groupKey);
    if (!source || source.id === f.expenseId) continue;
    await db
      .update(expenses)
      .set({
        categoryId: source.categoryId,
        description: source.description,
        costCenter: source.costCenter,
        receiptPath: source.receiptPath,
        receiptMime: source.receiptMime,
        savedAt: source.savedAt,
        inheritedFromId: source.id,
      })
      .where(eq(expenses.id, f.expenseId))
      .run();
  }
}

/** Piloto: todos os cartões de funcionário viram o primeiro deles, com o portador informado. */
function mergeCards(file: ReturnType<typeof parseBvk3>, companyName: string, holderName: string): void {
  const isCompany = (name: string) => !!companyName && normalizeName(name).startsWith(companyName);
  const employeeCards = file.cards.filter((c) => !isCompany(c.holderName));
  if (!employeeCards.length) return;
  // Um dígito a mais na frente: mesmos 4 finais, mas uma impressão digital própria,
  // para não se misturar com o cartão real desse portador se ele já tiver sido importado
  const target = `9${employeeCards[0].cardNumber}`;
  const merged = new Set(employeeCards.map((c) => c.cardNumber));
  const totalBrlCents = employeeCards.reduce((sum, c) => sum + c.totalBrlCents, 0);
  file.cards = [...file.cards.filter((c) => isCompany(c.holderName)), { ...employeeCards[0], cardNumber: target, holderName, totalBrlCents }];
  for (const entry of file.entries) if (merged.has(entry.cardNumber)) entry.cardNumber = target;
}

function addDays(iso: string | null, days: number): string | null {
  if (!iso) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Deslocamento, em dias múltiplos de 7, que leva a última data de lançamento para até ontem. */
export function weeksUntil(file: ReturnType<typeof parseBvk3>, today: Date): number {
  const last = file.entries.map((e) => e.postingDate ?? e.purchaseDate).filter((d): d is string => !!d).sort().at(-1);
  if (!last) return 0;
  const yesterday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1);
  const [y, m, d] = last.split("-").map(Number);
  const days = Math.floor((yesterday - Date.UTC(y, m - 1, d)) / 86400000);
  return days > 0 ? Math.floor(days / 7) * 7 : 0;
}

export function shiftFileDates(file: ReturnType<typeof parseBvk3>, days: number): void {
  if (!days) return;
  if (file.header) {
    file.header.processingDate = addDays(file.header.processingDate, days);
    file.header.dueDate = addDays(file.header.dueDate, days);
  }
  for (const e of file.entries) {
    e.purchaseDate = addDays(e.purchaseDate, days);
    e.postingDate = addDays(e.postingDate, days);
  }
}
