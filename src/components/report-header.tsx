import { dateTime, money } from "@/lib/format";
import type { ReportSummary } from "@/lib/reports";
import { ReportBadge } from "@/components/status-badge";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-lg text-ink">{children}</dd>
    </div>
  );
}

/** Cabeçalho do relatório na aprovação: cada informação com o seu rótulo, só o que importa. */
export function ReportHeader({ summary }: { summary: ReportSummary }) {
  const { report, owner } = summary;
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="head text-3xl text-ink">{report.name}</h1>
        <ReportBadge stage={summary.stage} />
      </div>
      <dl className="mt-6 grid gap-x-8 gap-y-5 border-y border-rule py-5 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        <Item label="funcionário">{owner?.name ?? "não informado"}</Item>
        <Item label="centro de custo">{report.costCenter || "não informado"}</Item>
        {report.submittedAt && <Item label="enviado em">{dateTime(report.submittedAt).replace(", ", " às ")}</Item>}
        <div className="min-w-0">
          <dt className="label">total</dt>
          <dd className="figure mt-1 text-3xl">{money(summary.totalCents)}</dd>
        </div>
        {summary.reimbursableCents > 0 && <Item label="a reembolsar">{money(summary.reimbursableCents)}</Item>}
        {summary.advances.length > 0 && (
          <Item label="adiantamento">
            {money(summary.advancedCents)}
            <span className="block text-sm text-muted">gasto {money(summary.spentFromAdvanceCents)}</span>
            {summary.advanceBalanceCents !== 0 && (
              <span className="block text-sm text-muted">
                {summary.advanceBalanceCents > 0 ? `a devolver ${money(summary.advanceBalanceCents)}` : `a pagar ${money(-summary.advanceBalanceCents)}`}
              </span>
            )}
          </Item>
        )}
      </dl>
      {report.notes && (
        <div className="mt-4">
          <p className="label">observação do funcionário</p>
          <p className="mt-1 text-ink">{report.notes}</p>
        </div>
      )}
    </>
  );
}
