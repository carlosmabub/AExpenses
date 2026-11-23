import Link from "next/link";
import type { ExpenseRow } from "@/lib/expenses";
import { date, installmentLabel, money, timeLeft, titleCase } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/status";
import { CategoryIcon } from "./category-icon";
import { StatusBadge } from "./status-badge";

/** Quanto do prazo ainda resta (1 = acabou de chegar, 0 = venceu). */
function remaining(availableAt: string, dueAt: string, now: Date): number {
  const total = new Date(dueAt).getTime() - new Date(availableAt).getTime();
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (new Date(dueAt).getTime() - now.getTime()) / total));
}

/** Uma linha da lista de despesas: o que é, quanto, quando, e o prazo desenhado como uma linha. */
export function ExpenseCard({ expense, now, icons, href, footer, inReport = false }: { expense: ExpenseRow; now: Date; icons?: Map<number, string>; href?: string; footer?: React.ReactNode; inReport?: boolean }) {
  const { e, tx, status } = expense;
  const parcel = tx ? installmentLabel(tx.installment, tx.installmentsTotal) : null;
  const iconName = expense.category?.icon ?? (e.suggestedCategoryId ? icons?.get(e.suggestedCategoryId) : undefined);
  const waiting = status === "sem_relatorio" || status === "em_relatorio";
  const left = waiting ? remaining(e.availableAt, e.dueAt, now) : 0;
  const meta = [date(e.purchaseDate), e.city ? titleCase(e.city) : null, parcel?.toLowerCase(), e.kind === "saque" ? "saque" : null, e.source === "manual" ? PAYMENT_LABELS[e.paymentMethod] : null]
    .filter(Boolean)
    .join(", ");
  return (
    <li className="border-b border-rule">
      <Link href={href ?? `/app/despesas/${e.id}`} className="flex items-start gap-3 py-4 transition-colors duration-100 hover:bg-paper-2/60">
        <CategoryIcon name={iconName} className="mt-0.5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate font-medium text-ink">{expense.category?.name ?? "Sem tipo"}</p>
            <p className={`shrink-0 tabular-nums ${e.kind === "estorno" ? "text-success" : "text-ink"}`}>
              {e.kind === "estorno" ? "+" : ""}
              {money(e.amountCents)}
            </p>
          </div>
          <p className="truncate text-sm text-ink-2">{titleCase(e.merchant)}</p>
          <div className="mt-1 flex items-center justify-between gap-3 text-sm text-muted">
            <span className="truncate">{meta}</span>
            {waiting ? (
              <span className="shrink-0">{timeLeft(e.dueAt, now)}</span>
            ) : (
              <StatusBadge status={status} />
            )}
          </div>
          {expense.report && !inReport && status !== "sem_relatorio" && <p className="mt-1 truncate text-sm text-muted">relatório: {expense.report.name}</p>}
          {status === "devolvida" && e.reviewComment && <p className="mt-1 text-sm text-error">devolvida: {e.reviewComment}</p>}
          {waiting && (
            <div className="mt-3 h-0.5 rounded-pill bg-accent-soft" aria-hidden="true">
              <div className="h-0.5 origin-left rounded-pill bg-accent" style={{ transform: `scaleX(${left})` }} />
            </div>
          )}
        </div>
      </Link>
      {footer && <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 pb-3 pl-8 text-sm">{footer}</div>}
    </li>
  );
}
