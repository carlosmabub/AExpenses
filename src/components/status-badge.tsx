import { REPORT_STAGE_LABELS, STATUS_LABELS, type ExpenseStatus, type ReportStage } from "@/lib/status";

const EXPENSE_STYLES: Record<ExpenseStatus, string> = {
  sem_relatorio: "bg-accent-soft text-ink shadow-none",
  em_relatorio: "",
  em_aprovacao: "text-ink-2",
  aprovada: "bg-ink text-accent-ink shadow-none",
  devolvida: "text-error shadow-[inset_0_0_0_1.5px_var(--color-error)]",
  ignorada: "text-error shadow-[inset_0_0_0_1.5px_var(--color-error)]",
  estorno: "text-muted",
};

const REPORT_STYLES: Record<ReportStage, string> = {
  aberto: "bg-accent-soft text-ink shadow-none",
  em_aprovacao: "",
  com_devolucao: "text-error shadow-[inset_0_0_0_1.5px_var(--color-error)]",
  aprovado: "bg-ink text-accent-ink shadow-none",
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return <span className={`pill ${EXPENSE_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function ReportBadge({ stage }: { stage: ReportStage }) {
  return <span className={`pill ${REPORT_STYLES[stage]}`}>{REPORT_STAGE_LABELS[stage]}</span>;
}
