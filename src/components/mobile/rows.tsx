import Link from "next/link";
import { ChevronDown, FileText } from "lucide-react";
import type { ExpenseRow as Row } from "@/lib/expenses";
import type { ReportSummary } from "@/lib/reports";
import { date, money } from "@/lib/format";
import { REPORT_STAGE_LABELS, STATUS_LABELS, type ReportStage } from "@/lib/status";
import { CategoryIcon } from "@/components/category-icon";

const PAYMENT_CHIP: Record<string, string> = {
  cartao: "Cartão corporativo",
  dinheiro: "Dinheiro",
  adiantamento: "Adiantamento",
};

/** Linha de despesa: tipo, estabelecimento, valor, data e a forma de pagamento. */
export function ExpenseRow({ expense, href, icons, showStatus = false, footer }: { expense: Row; href: string; icons?: Map<number, string>; showStatus?: boolean; footer?: React.ReactNode }) {
  const { e, status } = expense;
  const iconName = expense.category?.icon ?? (e.suggestedCategoryId ? icons?.get(e.suggestedCategoryId) : undefined);
  const attention = status === "devolvida" || status === "ignorada";
  return (
    <li className="border-b border-rule last:border-b-0">
      <Link href={href} className="flex items-start gap-3 px-4 py-3 transition-colors duration-100 hover:bg-paper-2/60">
        <span className="icon-tile"><CategoryIcon name={iconName} size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink">{expense.category?.name ?? "Sem tipo"}</span>
          <span className="block truncate text-sm text-muted">{e.merchant}</span>
          {showStatus && status !== "sem_relatorio" && (
            <span className={`mt-0.5 block text-sm ${attention ? "text-error" : "text-ink-2"}`}>{STATUS_LABELS[status].replace(/^./, (c) => c.toUpperCase())}</span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="tabular-nums text-ink">
            {e.kind === "estorno" ? "+" : ""}
            {money(e.amountCents)} <span className="text-xs text-muted">BRL</span>
          </span>
          <span className="text-xs text-muted tabular-nums">{date(e.purchaseDate)}</span>
          <span className="chip">{PAYMENT_CHIP[e.paymentMethod]}</span>
        </span>
      </Link>
      {footer && <div className="flex items-center justify-between gap-3 px-4 pb-2 text-sm">{footer}</div>}
    </li>
  );
}

const STAGE_DOT: Record<ReportStage, string> = {
  aberto: "bg-link",
  em_aprovacao: "bg-muted",
  com_devolucao: "bg-error",
  aprovado: "bg-success",
};

/** Linha de relatório: nome, valor, data e o status com um ponto. */
export function ReportRow({ summary }: { summary: ReportSummary }) {
  const { report } = summary;
  return (
    <li className="border-b border-rule last:border-b-0">
      <Link href={`/app/relatorios/${report.id}`} className="flex items-start gap-3 px-4 py-3 transition-colors duration-100 hover:bg-paper-2/60">
        <span className="icon-tile"><FileText size={20} strokeWidth={1.75} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink">{report.name}</span>
          <span className="block text-sm text-muted">{summary.expenses.length} despesa{summary.expenses.length === 1 ? "" : "s"}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="tabular-nums text-ink">{money(summary.totalCents)} <span className="text-xs text-muted">BRL</span></span>
          <span className="text-xs text-muted tabular-nums">{date(report.createdAt)}</span>
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className={`h-2 w-2 rounded-pill ${STAGE_DOT[summary.stage]}`} aria-hidden="true" />
            {REPORT_STAGE_LABELS[summary.stage].replace(/^./, (c) => c.toUpperCase())}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Cartão branco que abre e fecha, com a contagem num círculo. */
export function SectionCard({ title, count, href, open = false, children }: { title: string; count: number; href: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="surface-card group overflow-hidden">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-ink">{title}</span>
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-pill bg-accent-soft px-2 text-sm tabular-nums text-ink">{count}</span>
        <ChevronDown size={18} aria-hidden="true" className="text-muted transition-transform duration-100 group-open:rotate-180" />
      </summary>
      <div className="border-t border-rule">
        {children}
        <Link href={href} className="link flex min-h-12 items-center justify-center gap-1 border-t border-rule text-link">Ver todas</Link>
      </div>
    </details>
  );
}
