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
  /** admin: painel completo; aprovador: funcionário que também aprova a equipe dele; funcionario: só o app */
  role: text("role", { enum: ["admin", "aprovador", "funcionario"] }).notNull().default("funcionario"),
  costCenter: text("cost_center").notNull().default(""),
  /** Nome do portador como o banco envia no arquivo; usado para vincular cartões novos */
  cardHolderName: text("card_holder_name").notNull().default(""),
  /** Líder (aprovador) que aprova os relatórios desta pessoa; sem líder, aprova o admin */
  leaderId: integer("leader_id"),
  /** Desligado da empresa: não entra mais no app, mas o histórico fica */
  terminatedAt: text("terminated_at"),
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
  /** Nome do ícone (ver src/components/category-icon.tsx); o default antigo fica para não recriar a tabela */
  icon: text("icon").notNull().default("🧾"),
  mccs: text("mccs").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Política: exige foto do comprovante para salvar a despesa */
  requiresReceipt: integer("requires_receipt", { mode: "boolean" }).notNull().default(true),
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

/** Legado do primeiro piloto: substituída por expenses (migração 0002 copia os dados). */
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

/** Relatório de despesas: o funcionário agrupa despesas e envia para aprovação. */
export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    name: text("name").notNull(),
    costCenter: text("cost_center").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: text("status", { enum: ["aberto", "enviado", "aprovado"] }).notNull().default("aberto"),
    submittedAt: text("submitted_at"),
    approvedAt: text("approved_at"),
    createdAt: createdAt(),
  },
  (t) => [index("reports_employee").on(t.employeeId)],
);

/** Dinheiro adiantado ao funcionário (ex.: antes de uma viagem), acertado num relatório. */
export const advances = sqliteTable("advances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  amountCents: integer("amount_cents").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  reportId: integer("report_id").references(() => reports.id),
  createdBy: integer("created_by").references(() => employees.id),
  createdAt: createdAt(),
});

/**
 * Despesa: o que o funcionário vê e preenche. Compras do cartão vêm do arquivo do banco
 * (transactionId); despesas manuais (dinheiro, adiantamento) são lançadas no app.
 * O dono de uma compra do cartão é o funcionário vinculado ao cartão (cards.employeeId);
 * employeeId só é preenchido nas manuais.
 */
export const expenses = sqliteTable(
  "expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transactionId: integer("transaction_id")
      .unique()
      .references(() => transactions.id),
    employeeId: integer("employee_id").references(() => employees.id),
    source: text("source", { enum: ["cartao", "manual"] }).notNull(),
    kind: text("kind", { enum: ["compra", "saque", "estorno"] }).notNull().default("compra"),
    paymentMethod: text("payment_method", { enum: ["cartao", "dinheiro", "adiantamento"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    purchaseDate: text("purchase_date"),
    merchant: text("merchant").notNull(),
    city: text("city").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id),
    suggestedCategoryId: integer("suggested_category_id").references(() => categories.id),
    description: text("description").notNull().default(""),
    costCenter: text("cost_center").notNull().default(""),
    receiptPath: text("receipt_path"),
    receiptMime: text("receipt_mime"),
    reportId: integer("report_id").references(() => reports.id),
    /** Quando o funcionário salvou a despesa completa (tipo, descrição, comprovante) */
    savedAt: text("saved_at"),
    /** Herdada de outra parcela da mesma compra */
    inheritedFromId: integer("inherited_from_id"),
    reviewStatus: text("review_status", { enum: ["aprovada", "devolvida"] }),
    reviewComment: text("review_comment").notNull().default(""),
    reviewedAt: text("reviewed_at"),
    reviewedBy: integer("reviewed_by").references(() => employees.id),
    /** Quando a despesa aparece para o funcionário (ISO) */
    availableAt: text("available_at").notNull(),
    /** Prazo para estar num relatório enviado (ISO); depois disso, "ignorada" */
    dueAt: text("due_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_employee").on(t.employeeId), index("expenses_report").on(t.reportId)],
);

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
export type Report = typeof reports.$inferSelect;
export type Advance = typeof advances.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
