import Link from "next/link";
import type { ExpenseRow } from "@/lib/expenses";
import { date, installmentLabel, money, timeLeft, titleCase } from "@/lib/format";
import { StatusBadge } from "./status-badge";

export function ExpenseCard({ expense, now, icons }: { expense: ExpenseRow; now: Date; icons?: Map<number, string> }) {
  const { tx, status } = expense;
  const parcel = installmentLabel(tx.installment, tx.installmentsTotal);
  return (
    <Link href={`/app/despesas/${tx.id}`} className="card flex items-center gap-3 p-3 active:scale-[0.99]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">
        {expense.category?.icon ?? (expense.suggestedCategoryId ? icons?.get(expense.suggestedCategoryId) : undefined) ?? "💳"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold text-slate-800">{titleCase(tx.merchant)}</p>
          <p className={`shrink-0 font-semibold ${tx.kind === "estorno" ? "text-emerald-600" : "text-slate-900"}`}>
            {tx.kind === "estorno" ? "+" : ""}
            {money(tx.amountCents)}
          </p>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="truncate">
            {date(tx.purchaseDate)} · {titleCase(tx.city)}
            {parcel ? ` · ${parcel}` : ""}
            {tx.kind === "saque" ? " · Saque" : ""}
          </span>
          {status === "pendente" ? (
            <span className="shrink-0 font-medium text-amber-600">{timeLeft(tx.dueAt, now)}</span>
          ) : (
            <StatusBadge status={status} />
          )}
        </div>
        {expense.classification && (
          <p className="mt-1 truncate text-xs text-slate-600">
            {expense.category?.name} · {expense.classification.description}
          </p>
        )}
      </div>
    </Link>
  );
}
