import type { Bvk3Entry } from "./parser";

/**
 * Tipo de cada lançamento do BVK3, deduzido do arquivo de exemplo do Bradesco.
 * A tabela oficial de códigos ainda precisa ser pedida ao banco; códigos novos
 * caem em "compra" quando têm MCC e em "ignorado" quando não têm.
 */
export type EntryKind = "compra" | "saque" | "estorno" | "ignorado";

/** Códigos que não representam gasto do funcionário. */
const NON_SPEND_CODES: Record<string, string> = {
  "": "saldo anterior",
  "0590": "pagamento da fatura",
  "0960": "ajuste de saque debitado em conta",
};

const WITHDRAWAL_CODES = new Set(["0O10"]);
const WITHDRAWAL_MCC = "06011";

export const TRANSACTION_CODE_LABELS: Record<string, string> = {
  "0609": "Compra à vista",
  "0603": "Compra parcelada",
  "0O10": "Saque",
  ...Object.fromEntries(Object.entries(NON_SPEND_CODES).filter(([k]) => k)),
};

export function entryKind(entry: Pick<Bvk3Entry, "transactionCode" | "mcc" | "debitCredit">): EntryKind {
  if (entry.transactionCode in NON_SPEND_CODES) return "ignorado";
  if (WITHDRAWAL_CODES.has(entry.transactionCode) || entry.mcc === WITHDRAWAL_MCC) {
    return entry.debitCredit === "C" ? "ignorado" : "saque";
  }
  if (!entry.mcc || /^0+$/.test(entry.mcc)) return "ignorado";
  return entry.debitCredit === "C" ? "estorno" : "compra";
}

/** Precisa de justificativa do funcionário? */
export function requiresClassification(kind: EntryKind): boolean {
  return kind === "compra" || kind === "saque";
}
