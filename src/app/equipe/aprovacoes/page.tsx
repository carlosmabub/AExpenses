import Link from "next/link";
import { getDb } from "@/db";
import { requireApprover } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import { listReportsForApproval } from "@/lib/reports";
import { ReportBadge } from "@/components/status-badge";

export default async function TeamApprovals() {
  const user = await requireApprover();
  const all = await listReportsForApproval(await getDb(), user);
  const waiting = all.filter((r) => r.stage !== "aprovado");
  const done = all.filter((r) => r.stage === "aprovado");
  const List = ({ rows, empty }: { rows: typeof all; empty: string }) =>
    rows.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : (
      <ul className="mt-3 border-t border-rule">
        {rows.map((r) => (
          <li key={r.report.id} className="border-b border-rule">
            <Link href={`/equipe/aprovacoes/${r.report.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4 hover:bg-paper-2/60">
              <span className="min-w-0 flex-1">
                <span className="block text-ink">{r.report.name}</span>
                <span className="block text-sm text-muted">{r.owner?.name}{r.report.submittedAt ? `, enviado em ${dateTime(r.report.submittedAt)}` : ""}</span>
              </span>
              <ReportBadge stage={r.stage} />
              <span className="tabular-nums text-ink">{money(r.totalCents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <h1 className="head text-3xl text-ink">aprovações</h1>
      <p className="mt-2 text-sm text-muted">Relatórios enviados pela sua equipe.</p>
      <h2 className="head mt-8 text-xl text-ink">aguardando você</h2>
      <List rows={waiting} empty="Nenhum relatório esperando." />
      <h2 className="head mt-10 text-xl text-ink">aprovados</h2>
      <List rows={done} empty="Nenhum ainda." />
    </>
  );
}
