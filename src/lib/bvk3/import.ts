import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db, DbLike } from "@/db";
import { cards, categories, classifications, employees, importBatches, transactions } from "@/db/schema";
import { cardFingerprint, cardLast4 } from "@/lib/card-fingerprint";
import { addHours, clockMode, dailyFileAvailability, deadlineHours, now, setClock, simulatedNow } from "@/lib/clock";
import { normalizeMcc, suggestCategory } from "@/lib/mcc";
import { checkBvk3, parseBvk3 } from "./parser";
import { entryKind } from "./codes";

export interface ImportOptions {
  fileName: string;
  content: string;
  importedBy?: number;
  /** Importa mesmo que a conferência com o trailer falhe */
  force?: boolean;
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
  const hours = await deadlineHours(db);
  const activeCategories = await db.select().from(categories).all();
  const employeesByHolder = new Map(
    (await db.select().from(employees).all())
      .filter((e) => e.cardHolderName)
      .map((e) => [normalizeName(e.cardHolderName), e.id]),
  );
  const companyName = normalizeName(file.header?.companyName ?? "");

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
    for (const card of file.cards) {
      const fingerprint = fingerprints.get(card.cardNumber)!;
      let row = existing.get(fingerprint);
      if (!row) {
        // O registro da conta da empresa traz o nome dela no campo do portador
        const isBillingAccount = !!companyName && normalizeName(card.holderName).startsWith(companyName);
        row = await tx
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
        dueAt: addHours(availableAt, hours).toISOString(),
      });
    }

    const insertedIds: number[] = [];
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const inserted = await tx
        .insert(transactions)
        .values(rows.slice(i, i + INSERT_CHUNK))
        .onConflictDoNothing()
        .returning({ id: transactions.id })
        .all();
      insertedIds.push(...inserted.map((r) => r.id));
    }
    base.newTransactions = insertedIds.length;
    base.duplicateTransactions = rows.length - insertedIds.length;

    // Parcelas novas de compras já classificadas herdam a classificação
    if (insertedIds.length) await inheritGroupClassifications(tx, insertedIds);

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

async function inheritGroupClassifications(db: DbLike, transactionIds: number[]): Promise<void> {
  const fresh = await db
    .select({ id: transactions.id, groupKey: transactions.groupKey })
    .from(transactions)
    .where(inArray(transactions.id, transactionIds))
    .all();
  const groupKeys = [...new Set(fresh.map((t) => t.groupKey))];
  const sources = await db
    .select({ c: classifications, groupKey: transactions.groupKey })
    .from(classifications)
    .innerJoin(transactions, eq(transactions.id, classifications.transactionId))
    .where(and(inArray(transactions.groupKey, groupKeys), isNull(classifications.inheritedFromId)))
    .all();
  if (!sources.length) return;
  const byGroup = new Map(sources.map((s) => [s.groupKey, s.c]));
  const copies = fresh.flatMap((t) => {
    const source = byGroup.get(t.groupKey);
    if (!source) return [];
    const { id: sourceId, transactionId: _ignored, ...rest } = source;
    return [{ ...rest, transactionId: t.id, inheritedFromId: sourceId }];
  });
  if (copies.length) await db.insert(classifications).values(copies).onConflictDoNothing().run();
}
