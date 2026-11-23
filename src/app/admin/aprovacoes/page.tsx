import Link from "next/link";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { listReportsForApproval } from "@/lib/reports";
import { dateTime, money } from "@/lib/format";
import { PageTitle } from "@/components/page-title";
import { ReportBadge } from "@/components/status-badge";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const admin = await requireAdmin();
  const all = await listReportsForApproval(await getDb(), admin);
  const waiting = all.filter((r) => r.stage !== "aprovado");
  const done = all.filter((r) => r.stage === "aprovado");
  const showDone = (await searchParams).aba === "aprovados";
  const rows = showDone ? done : waiting;
  const tabs = [
    { href: "/admin/aprovacoes", label: "aguardando", count: waiting.length, active: !showDone },
    { href: "/admin/aprovacoes?aba=aprovados", label: "aprovados", count: done.length, active: showDone },
  ];

  return (
    <>
      <PageTitle title="aprovações" subtitle="Relatórios enviados pelos funcionários." />
      <nav aria-label="Situação dos relatórios" className="flex gap-1">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined}
            className={`flex min-h-10 items-center gap-2 rounded-pill px-4 font-display text-sm lowercase ${t.active ? "bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-2"}`}>
            {t.label}
            <span className="tabular-nums text-muted">{t.count}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-4 overflow-x-auto">
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
                <td className="truncate"><Link href={`/admin/aprovacoes/${r.report.id}`} className="link font-medium text-ink">{r.report.name}</Link></td>
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
