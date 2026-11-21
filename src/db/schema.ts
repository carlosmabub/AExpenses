import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "funcionario"] }).notNull().default("funcionario"),
  costCenter: text("cost_center").notNull().default(""),
  /** Nome do portador como o banco envia no arquivo; usado para vincular cartões novos */
  cardHolderName: text("card_holder_name").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fingerprint: text("fingerprint").notNull().unique(),
  last4: text("last4").notNull(),
  holderName: text("holder_name").notNull(),
  /** Centro de custo informado pelo banco (referência; o do funcionário prevalece) */
  bankCostCenter: text("bank_cost_center").notNull().default(""),
  /** Billing account da empresa (não é cartão de funcionário) */
  isBillingAccount: integer("is_billing_account", { mode: "boolean" }).notNull().default(false),
  employeeId: integer("employee_id").references(() => employees.id),
  createdAt: createdAt(),
});

export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  companyName: text("company_name").notNull().default(""),
  processingDate: text("processing_date"),
  dueDate: text("due_date"),
  trailerTransactions: integer("trailer_transactions"),
  trailerTotalCents: integer("trailer_total_cents"),
  readEntries: integer("read_entries").notNull(),
  readTotalCents: integer("read_total_cents").notNull(),
  checkOk: integer("check_ok", { mode: "boolean" }).notNull(),
  problems: text("problems").notNull().default("[]"),
  newTransactions: integer("new_transactions").notNull(),
  duplicateTransactions: integer("duplicate_transactions").notNull(),
  ignoredEntries: integer("ignored_entries").notNull(),
  simulated: integer("simulated", { mode: "boolean" }).notNull(),
  importedBy: integer("imported_by").references(() => employees.id),
  createdAt: createdAt(),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull().default("🧾"),
  mccs: text("mccs").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchId: integer("batch_id")
      .notNull()
      .references(() => importBatches.id),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id),
    reference: text("reference").notNull(),
    kind: text("kind", { enum: ["compra", "saque", "estorno"] }).notNull(),
    transactionCode: text("transaction_code").notNull(),
    purchaseDate: text("purchase_date"),
    postingDate: text("posting_date"),
    installment: integer("installment").notNull().default(0),
    installmentsTotal: integer("installments_total").notNull().default(0),
    /** Identifica a compra original de uma série de parcelas */
    groupKey: text("group_key").notNull(),
    amountCents: integer("amount_cents").notNull(),
    originalAmountMillis: integer("original_amount_millis").notNull(),
    originalCurrency: text("original_currency").notNull(),
    merchant: text("merchant").notNull(),
    merchantCnpj: text("merchant_cnpj").notNull().default(""),
    city: text("city").notNull().default(""),
    state: text("state").notNull().default(""),
    mcc: text("mcc").notNull().default(""),
    activityDescription: text("activity_description").notNull().default(""),
    authorizationCode: text("authorization_code").notNull().default(""),
    suggestedCategoryId: integer("suggested_category_id").references(() => categories.id),
    /** Quando a compra fica visível para o funcionário (ISO) */
    availableAt: text("available_at").notNull(),
    /** Prazo para classificar (ISO); depois disso, "ignorada" */
    dueAt: text("due_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // Um estorno pode repetir o reference number da compra original, por isso o tipo entra na chave
    uniqueIndex("transactions_dedup").on(t.cardId, t.reference, t.installment, t.kind),
    index("transactions_card").on(t.cardId),
    index("transactions_group").on(t.groupKey),
  ],
);

export const classifications = sqliteTable("classifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transactionId: integer("transaction_id")
    .notNull()
    .unique()
    .references(() => transactions.id),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  description: text("description").notNull(),
  costCenter: text("cost_center").notNull().default(""),
  receiptPath: text("receipt_path"),
  receiptMime: text("receipt_mime"),
  /** Herdada de outra parcela da mesma compra */
  inheritedFromId: integer("inherited_from_id"),
  classifiedBy: integer("classified_by").references(() => employees.id),
  classifiedAt: text("classified_at").notNull(),
});

/** Configurações chave/valor (relógio do piloto, prazo etc.) */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Classification = typeof classifications.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
