import Link from "next/link";
import { dateTime, money } from "@/lib/format";
import type { ReportSummary } from "@/lib/reports";
import { ReportBadge } from "@/components/status-badge";

/** Lista de relatórios para aprovar: abas aguardando/aprovados e colunas fixas (usada pelo admin e pelo líder). */
export function ApprovalsList({ reports, basePath, showDone }: { reports: ReportSummary[]; basePath: string; showDone: boolean }) {
  const waiting = reports.filter((r) => r.stage !== "aprovado");
  const done = reports.filter((r) => r.stage === "aprovado");
  const rows = showDone ? done : waiting;
  const tabs = [
    { href: basePath, label: "aguardando", count: waiting.length, active: !showDone },
    { href: `${basePath}?aba=aprovados`, label: "aprovados", count: done.length, active: showDone },
  ];
  return (
    <>
      <nav aria-label="Situação dos relatórios" className="flex gap-1">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined}
            className={`flex min-h-10 items-center gap-2 rounded-pill px-4 font-display text-sm lowercase ${t.active ? "bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-2"}`}>
            {t.label}
            <span className="tabular-nums text-muted">{t.count}</span>
          </Link>
        ))}
      </nav>
      {/* Celular: uma linha por relatório, sem rolagem lateral */}
      <ul className="mt-4 border-t border-rule md:hidden">
        {rows.length === 0 && <li className="py-6 text-sm text-muted">{showDone ? "Nenhum relatório aprovado ainda." : "Nenhum relatório aguardando aprovação."}</li>}
        {rows.map((r) => (
          <li key={r.report.id} className="border-b border-rule">
            <Link href={`${basePath}/${r.report.id}`} className="block py-4">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-medium text-ink">{r.report.name}</span>
                <span className="shrink-0 tabular-nums text-ink">{money(r.totalCents)}</span>
              </span>
              <span className="mt-1 flex items-center justify-between gap-3 text-sm text-muted">
                <span className="min-w-0">{r.owner?.name}, {r.expenses.length} despesa{r.expenses.length === 1 ? "" : "s"}</span>
                <ReportBadge stage={r.stage} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="data-table w-full min-w-[760px] table-fixed">
          <colgroup>
            <col />
            <col className="w-40" />
            <col className="w-56" />
            <col className="w-24" />
            <col className="w-32" />
            <col className="w-36" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">relatório</th><th scope="col">funcionário</th><th scope="col">enviado em</th>
              <th scope="col" className="text-right">despesas</th><th scope="col" className="text-right">total</th><th scope="col">situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-muted">{showDone ? "Nenhum relatório aprovado ainda." : "Nenhum relatório aguardando aprovação."}</td></tr>}
            {rows.map((r) => (
              <tr key={r.report.id}>
                <td className="truncate"><Link href={`${basePath}/${r.report.id}`} className="link font-medium text-ink">{r.report.name}</Link></td>
                <td className="truncate">{r.owner?.name}</td>
                <td className="whitespace-nowrap tabular-nums text-muted">{r.report.submittedAt ? dateTime(r.report.submittedAt).replace(", ", " às ") : ""}</td>
                <td className="text-right tabular-nums">{r.expenses.length}</td>
                <td className="text-right tabular-nums">{money(r.totalCents)}</td>
                <td><ReportBadge stage={r.stage} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
