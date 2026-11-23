import Link from "next/link";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { listReportsForApproval } from "@/lib/reports";
import { dateTime, money } from "@/lib/format";
import { PageTitle } from "@/components/page-title";
import { ReportBadge } from "@/components/status-badge";

export default async function ApprovalsPage() {
  const admin = await requireAdmin();
  const all = await listReportsForApproval(await getDb(), admin);
  const waiting = all.filter((r) => r.stage !== "aprovado");
  const done = all.filter((r) => r.stage === "aprovado");
  const Table = ({ rows, empty }: { rows: typeof all; empty: string }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="data-table min-w-[720px]">
        <thead>
          <tr><th scope="col">relatório</th><th scope="col">funcionário</th><th scope="col">enviado em</th><th scope="col" className="text-right">despesas</th><th scope="col" className="text-right">total</th><th scope="col">situação</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-muted">{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={r.report.id}>
              <td><Link href={`/admin/aprovacoes/${r.report.id}`} className="link font-medium text-ink">{r.report.name}</Link></td>
              <td>{r.owner?.name}</td>
              <td className="tabular-nums text-muted">{r.report.submittedAt ? dateTime(r.report.submittedAt) : ""}</td>
              <td className="text-right tabular-nums">{r.expenses.length}</td>
              <td className="text-right tabular-nums">{money(r.totalCents)}</td>
              <td><ReportBadge stage={r.stage} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <PageTitle title="aprovações" subtitle="Relatórios enviados pelos funcionários. Por enquanto o financeiro aprova; depois entra o líder de cada equipe." />
      <section aria-labelledby="aguardando">
        <h2 id="aguardando" className="head text-xl text-ink">aguardando</h2>
        <Table rows={waiting} empty="Nenhum relatório aguardando aprovação." />
      </section>
      <section className="mt-12" aria-labelledby="aprovados">
        <h2 id="aprovados" className="head text-xl text-ink">aprovados</h2>
        <Table rows={done} empty="Nenhum relatório aprovado ainda." />
      </section>
    </>
  );
}
