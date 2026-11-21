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

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

export function importBvk3(db: Db, options: ImportOptions): ImportResult {
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

  const simulated = clockMode(db) === "simulado";
  const importTime = now(db);
  const hours = deadlineHours(db);
  const activeCategories = db.select().from(categories).all();
  const employeesByHolder = new Map(
    db
      .select()
      .from(employees)
      .all()
      .filter((e) => e.cardHolderName)
      .map((e) => [normalizeName(e.cardHolderName), e.id]),
  );
  const companyName = normalizeName(file.header?.companyName ?? "");

  return db.transaction((tx) => {
    const batch = tx
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
    const cardIds = new Map<string, number>();
    for (const card of file.cards) {
      const fingerprint = cardFingerprint(card.cardNumber);
      let row = tx.select().from(cards).where(eq(cards.fingerprint, fingerprint)).get();
      if (!row) {
        // O registro da conta da empresa traz o nome dela no campo do portador
        const isBillingAccount = !!companyName && normalizeName(card.holderName).startsWith(companyName);
        row = tx
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
        base.newCards++;
      }
      cardIds.set(card.cardNumber, row.id);
      if (!row.employeeId && !row.isBillingAccount) base.unlinkedCards.push(`${row.holderName} (final ${row.last4})`);
    }

    const insertedIds: number[] = [];
    for (const entry of file.entries) {
      const kind = entryKind(entry);
      if (kind === "ignorado") {
        base.ignoredEntries++;
        continue;
      }
      const cardId = cardIds.get(entry.cardNumber);
      if (!cardId) {
        base.ignoredEntries++;
        continue;
      }
      const availableAt = simulated && entry.postingDate ? dailyFileAvailability(entry.postingDate) : importTime;
      const groupKey =
        entry.installmentsTotal > 1
          ? `${cardId}|${entry.purchaseDate}|${entry.description}|${entry.installmentsTotal}`
          : `${cardId}|${entry.reference}|${kind}`;
      const suggested = kind === "compra" || kind === "saque" ? suggestCategory(activeCategories, entry.mcc) : undefined;

      const inserted = tx
        .insert(transactions)
        .values({
          batchId: batch.id,
          cardId,
          reference: entry.reference,
          kind,
          transactionCode: entry.transactionCode,
          purchaseDate: entry.purchaseDate,
          postingDate: entry.postingDate,
          installment: entry.installment,
          installmentsTotal: entry.installmentsTotal,
          groupKey,
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
        })
        .onConflictDoNothing()
        .returning({ id: transactions.id, groupKey: transactions.groupKey })
        .get();

      if (inserted) {
        base.newTransactions++;
        insertedIds.push(inserted.id);
      } else {
        base.duplicateTransactions++;
      }
    }

    // Parcelas novas de compras já classificadas herdam a classificação
    if (insertedIds.length) inheritGroupClassifications(tx, insertedIds);

    tx.update(importBatches)
      .set({
        newTransactions: base.newTransactions,
        duplicateTransactions: base.duplicateTransactions,
        ignoredEntries: base.ignoredEntries,
      })
      .where(eq(importBatches.id, batch.id))
      .run();

    // No modo simulado, o relógio começa na chegada do primeiro "arquivo diário"
    if (simulated && !simulatedNow(tx) && insertedIds.length) {
      const first = tx
        .select({ at: sql<string>`min(${transactions.availableAt})` })
        .from(transactions)
        .get();
      if (first?.at) setClock(tx, new Date(first.at));
    }

    return { ...base, imported: true, batchId: batch.id };
  });
}

function inheritGroupClassifications(db: DbLike, transactionIds: number[]): void {
  const fresh = db
    .select({ id: transactions.id, groupKey: transactions.groupKey })
    .from(transactions)
    .leftJoin(classifications, eq(classifications.transactionId, transactions.id))
    .where(and(inArray(transactions.id, transactionIds), isNull(classifications.id)))
    .all();
  for (const t of fresh) {
    const source = db
      .select({ c: classifications })
      .from(classifications)
      .innerJoin(transactions, eq(transactions.id, classifications.transactionId))
      .where(and(eq(transactions.groupKey, t.groupKey), isNull(classifications.inheritedFromId)))
      .get();
    if (!source) continue;
    const { id: sourceId, transactionId: _ignored, ...rest } = source.c;
    db.insert(classifications)
      .values({ ...rest, transactionId: t.id, inheritedFromId: sourceId })
      .onConflictDoNothing()
      .run();
  }
}
