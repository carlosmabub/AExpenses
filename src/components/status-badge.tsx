import type { ExpenseStatus } from "@/lib/status";
import { STATUS_LABELS } from "@/lib/status";

const STYLES: Record<ExpenseStatus, string> = {
  pendente: "bg-amber-50 text-amber-700 ring-amber-200",
  classificada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ignorada: "bg-red-50 text-red-700 ring-red-200",
  estorno: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
