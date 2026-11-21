export type ExpenseStatus = "pendente" | "classificada" | "ignorada" | "estorno";

export interface StatusInput {
  kind: string;
  dueAt: string;
  classifiedAt?: string | null;
}

/**
 * O status é calculado (não gravado), para seguir o relógio do piloto:
 * sem classificação e com o prazo vencido = ignorada, e vai para o admin.
 */
export function expenseStatus(tx: StatusInput, now: Date): ExpenseStatus {
  if (tx.kind === "estorno") return "estorno";
  if (tx.classifiedAt) return "classificada";
  return now.getTime() >= new Date(tx.dueAt).getTime() ? "ignorada" : "pendente";
}

/** Classificada depois do prazo */
export function classifiedLate(tx: StatusInput): boolean {
  return !!tx.classifiedAt && new Date(tx.classifiedAt).getTime() > new Date(tx.dueAt).getTime();
}

export const STATUS_LABELS: Record<ExpenseStatus, string> = {
  pendente: "Pendente",
  classificada: "Classificada",
  ignorada: "Ignorada",
  estorno: "Estorno",
};
