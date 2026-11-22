import Link from "next/link";
import type { ExpenseRow } from "@/lib/expenses";
import { date, installmentLabel, money, timeLeft, titleCase } from "@/lib/format";
import { CategoryIcon } from "./category-icon";
import { StatusBadge } from "./status-badge";

/** Quanto do prazo ainda resta (1 = acabou de chegar, 0 = venceu). */
function remaining(availableAt: string, dueAt: string, now: Date): number {
  const total = new Date(dueAt).getTime() - new Date(availableAt).getTime();
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (new Date(dueAt).getTime() - now.getTime()) / total));
}

/** Uma linha da fila de despesas: o que é, quanto, quando, e o prazo desenhado em violeta. */
export function ExpenseCard({ expense, now, icons }: { expense: ExpenseRow; now: Date; icons?: Map<number, string> }) {
  const { tx, status } = expense;
  const parcel = installmentLabel(tx.installment, tx.installmentsTotal);
  const iconName = expense.category?.icon ?? (expense.suggestedCategoryId ? icons?.get(expense.suggestedCategoryId) : undefined);
  const left = status === "pendente" ? remaining(tx.availableAt, tx.dueAt, now) : 0;
  return (
    <li className="border-b border-rule">
      <Link href={`/app/despesas/${tx.id}`} className="flex items-start gap-3 py-4 transition-colors duration-100 hover:bg-paper-2/60">
        <CategoryIcon name={iconName} className="mt-0.5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate font-medium text-ink">{titleCase(tx.merchant)}</p>
            <p className={`shrink-0 tabular-nums ${tx.kind === "estorno" ? "text-success" : "text-ink"}`}>
              {tx.kind === "estorno" ? "+" : ""}
              {money(tx.amountCents)}
            </p>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-sm text-muted">
            <span className="truncate">
              {date(tx.purchaseDate)}, {titleCase(tx.city)}
              {parcel ? `, ${parcel.toLowerCase()}` : ""}
              {tx.kind === "saque" ? ", saque" : ""}
            </span>
            {status === "pendente" ? (
              <span className={`shrink-0 ${left < 0.5 ? "text-accent" : ""}`}>{timeLeft(tx.dueAt, now)}</span>
            ) : (
              <StatusBadge status={status} />
            )}
          </div>
          {expense.classification && (
            <p className="mt-1 truncate text-sm text-ink-2">
              {expense.category?.name}: {expense.classification.description}
            </p>
          )}
          {status === "pendente" && (
            <div className="mt-3 h-0.5 rounded-pill bg-accent-soft" aria-hidden="true">
              <div className="h-0.5 origin-left rounded-pill bg-accent" style={{ transform: `scaleX(${left})` }} />
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
