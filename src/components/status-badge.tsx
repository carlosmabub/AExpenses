import { STATUS_LABELS, type ExpenseStatus } from "@/lib/status";

const STYLES: Record<ExpenseStatus, string> = {
  pendente: "bg-accent-soft text-ink shadow-none",
  classificada: "",
  ignorada: "text-error shadow-[inset_0_0_0_1.5px_var(--color-error)]",
  estorno: "text-muted",
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return <span className={`pill ${STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}
