import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Paperclip } from "lucide-react";
import { getDb } from "@/db";
import { requireApprover } from "@/lib/auth";
import { canReview } from "@/lib/people";
import { getReport } from "@/lib/reports";
import { date, dateTime, money, titleCase } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/status";
import { ReportBadge, StatusBadge } from "@/components/status-badge";
import { CategoryIcon } from "@/components/category-icon";
import { approveRemainingAction } from "@/app/admin/actions";
import { ReviewControls } from "@/components/review-controls";
import { BulkApprove } from "@/components/bulk-approve";

export default async function TeamApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireApprover();
  const db = await getDb();
  const summary = await getReport(db, Number((await params).id));
  if (!summary || summary.report.status === "aberto" || !(await canReview(db, user, summary.report.employeeId))) notFound();
  const { report } = summary;
  const reviewing = report.status === "enviado";
  const unreviewed = summary.expenses.filter((e) => !e.e.reviewStatus).length;
  const isPending = (r: (typeof summary.expenses)[number]) => reviewing && !r.e.reviewStatus;

  return (
    <div>
      <Link href="/equipe/aprovacoes" className="link inline-flex min-h-10 items-center gap-1 font-display text-sm lowercase text-muted">
        <ChevronLeft size={16} aria-hidden="true" /> aprovações
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="head text-3xl text-ink">{report.name}</h1>
          <p className="mt-2 text-sm text-muted">
            {summary.owner?.name}, centro de custo {report.costCenter || "não informado"}
            {report.submittedAt ? `, enviado em ${dateTime(report.submittedAt)}` : ""}
          </p>
        </div>
        <ReportBadge stage={summary.stage} />
      </div>

      <dl className="mt-6 grid border-y border-rule sm:grid-cols-3">
        <div className="py-4 pr-6"><dt className="label">total</dt><dd className="figure text-4xl">{money(summary.totalCents)}</dd></div>
        <div className="py-4 pr-6 sm:border-l sm:border-rule sm:pl-6"><dt className="label">a reembolsar ao funcionário</dt><dd className="figure text-4xl">{money(summary.reimbursableCents)}</dd></div>
        <div className="py-4 sm:border-l sm:border-rule sm:pl-6">
          <dt className="label">adiantamento</dt>
          {summary.advances.length ? (
            <>
              <dd className="figure text-4xl">{money(summary.advancedCents)}</dd>
              <dd className="mt-1 text-sm text-muted">
                gasto {money(summary.spentFromAdvanceCents)}
                {summary.advanceBalanceCents > 0 ? `, a devolver ${money(summary.advanceBalanceCents)}` : summary.advanceBalanceCents < 0 ? `, a pagar ${money(-summary.advanceBalanceCents)}` : ", acertado"}
              </dd>
            </>
          ) : (
            <dd className="mt-1 text-muted">nenhum</dd>
          )}
        </div>
      </dl>
      {report.notes && <p className="mt-4 text-sm text-ink-2">Observações do funcionário: {report.notes}</p>}

      <section className="mt-10" aria-labelledby="despesas">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="despesas" className="head text-xl text-ink">despesas</h2>
          {reviewing && unreviewed > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <BulkApprove total={unreviewed} />
            <form action={approveRemainingAction}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" className="btn-ghost">aprovar as {unreviewed} restantes</button>
            </form>
            </div>
          )}
        </div>
        <ul className="mt-3 border-t border-rule">
          {summary.expenses.map((r) => (
            <li key={r.e.id} className="grid gap-4 border-b border-rule py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex min-w-0 gap-3">
                {isPending(r) && (
                  <label className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center">
                    <input type="checkbox" name="expenseIds" value={r.e.id} form="bulk-approve" className="h-4 w-4 accent-[var(--color-ink)]" aria-label={`Selecionar ${r.category?.name ?? "despesa"} de ${money(r.e.amountCents)}`} />
                  </label>
                )}
                <CategoryIcon name={r.category?.icon} className="mt-0.5 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {r.category?.name}: <span className="tabular-nums">{money(r.e.amountCents)}</span>
                  </p>
                  <p className="text-sm text-ink-2">{titleCase(r.e.merchant)}, {date(r.e.purchaseDate)}, {PAYMENT_LABELS[r.e.paymentMethod]}{r.card ? ` final ${r.card.last4}` : ""}</p>
                  <p className="mt-1 text-sm text-ink">{r.e.description}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
                    <span>tipo: {r.category?.name ?? "não informado"}</span>
                    <span>centro de custo: {r.e.costCenter || "não informado"}</span>
                    {r.e.receiptPath ? (
                      <a href={`/recibo/${r.e.id}`} target="_blank" className="link inline-flex items-center gap-1 text-link"><Paperclip size={14} aria-hidden="true" /> comprovante</a>
                    ) : (
                      <span className="text-error">sem comprovante</span>
                    )}
                    
                  </p>
                  {r.e.reviewStatus === "devolvida" && <p className="mt-1 text-sm text-error">devolvida: {r.e.reviewComment}</p>}
                </div>
              </div>
              <div className="flex items-start justify-end">
                {reviewing && r.e.reviewStatus !== "aprovada" && r.e.reviewStatus !== "devolvida" ? (
                  <ReviewControls expenseId={r.e.id} label={`${r.category?.name} de ${money(r.e.amountCents)}`} />
                ) : (
                  <StatusBadge status={r.status} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
