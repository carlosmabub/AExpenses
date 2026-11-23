import Link from "next/link";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { listEmployeeReports } from "@/lib/reports";
import { money } from "@/lib/format";
import { ReportBadge } from "@/components/status-badge";

export default async function ReportsPage() {
  const user = await requireUser();
  const reports = await listEmployeeReports(await getDb(), user.id);
  return (
    <>
      <div className="flex items-end justify-between gap-3 pt-6">
        <h1 className="head text-3xl text-ink">relatórios</h1>
        <Link href="/app/relatorios/novo" className="btn-ghost">novo relatório</Link>
      </div>
      {reports.length === 0 ? (
        <p className="mt-6 border-t border-rule pt-4 text-sm text-muted">Nenhum relatório ainda. Crie um e lance nele as despesas da viagem ou do mês.</p>
      ) : (
        <ul className="mt-5 border-t border-rule">
          {reports.map((r) => (
            <li key={r.report.id} className="border-b border-rule">
              <Link href={`/app/relatorios/${r.report.id}`} className="flex items-center justify-between gap-3 py-4 hover:bg-paper-2/60">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{r.report.name}</span>
                  <span className="block text-sm text-muted">{r.expenses.length} despesa{r.expenses.length === 1 ? "" : "s"}, {money(r.totalCents)}</span>
                </span>
                <ReportBadge stage={r.stage} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
