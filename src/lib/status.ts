export type ExpenseStatus = "sem_relatorio" | "em_relatorio" | "em_aprovacao" | "aprovada" | "devolvida" | "ignorada" | "estorno";

export interface StatusInput {
  kind: string;
  dueAt: string;
  reviewStatus?: string | null;
  reportStatus?: string | null;
}

/**
 * O status é calculado (não gravado), para seguir o relógio do piloto.
 * Uma despesa que não está num relatório enviado até o prazo vira "ignorada" e aparece para o financeiro.
 */
export function expenseStatus(e: StatusInput, now: Date): ExpenseStatus {
  if (e.kind === "estorno") return "estorno";
  if (e.reviewStatus === "aprovada") return "aprovada";
  if (e.reviewStatus === "devolvida") return "devolvida";
  if (e.reportStatus === "enviado" || e.reportStatus === "aprovado") return "em_aprovacao";
  if (now.getTime() >= new Date(e.dueAt).getTime()) return "ignorada";
  return e.reportStatus === "aberto" ? "em_relatorio" : "sem_relatorio";
}

/** Precisa de ação do funcionário */
export function needsAction(status: ExpenseStatus): boolean {
  return status === "sem_relatorio" || status === "em_relatorio" || status === "devolvida" || status === "ignorada";
}

export const STATUS_LABELS: Record<ExpenseStatus, string> = {
  sem_relatorio: "sem relatório",
  em_relatorio: "em relatório",
  em_aprovacao: "em aprovação",
  aprovada: "aprovada",
  devolvida: "devolvida",
  ignorada: "ignorada",
  estorno: "estorno",
};

export const PAYMENT_LABELS: Record<string, string> = {
  cartao: "cartão corporativo",
  dinheiro: "dinheiro (reembolso)",
  adiantamento: "adiantamento",
};

/** Fim do mês da compra, 23:59:59 em Brasília (UTC-3), com no mínimo 5 dias desde a chegada. */
export function expenseDeadline(purchaseDate: string | null, availableAt: Date): Date {
  const minimum = new Date(availableAt.getTime() + 5 * 24 * 3600 * 1000);
  const base = purchaseDate ?? availableAt.toISOString().slice(0, 10);
  const [y, m] = base.split("-").map(Number);
  const endOfMonth = new Date(Date.UTC(y, m, 1, 2, 59, 59)); // dia 1 do mês seguinte, 02:59:59Z = 23:59:59 em Brasília
  return endOfMonth > minimum ? endOfMonth : minimum;
}

export type ReportStage = "aberto" | "em_aprovacao" | "com_devolucao" | "aprovado";

export const REPORT_STAGE_LABELS: Record<ReportStage, string> = {
  aberto: "aberto",
  em_aprovacao: "em aprovação",
  com_devolucao: "com devolução",
  aprovado: "aprovado",
};
