import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { getReport, openAdvances } from "@/lib/reports";
import { date, money, titleCase } from "@/lib/format";
import { ExpenseCard } from "@/components/expense-card";
import { ReportBadge } from "@/components/status-badge";
import { ReportForm, SubmitReportButton } from "../report-form";
import { addExpensesAction, removeExpenseAction, submitReportAction, updateReportAction } from "../actions";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const db = await getDb();
  const summary = await getReport(db, Number((await params).id));
  if (!summary || summary.report.employeeId !== user.id) notFound();
  const { report } = summary;
  const at = await now(db);
  const icons = new Map((await listCategories(db, false)).map((c) => [c.id, c.icon]));
  const open = report.status === "aberto";
  const available = open ? (await listEmployeeExpenses(db, user.id)).filter((e) => e.status === "sem_relatorio" || e.status === "ignorada") : [];
  const freeAdvances = open ? await openAdvances(db, user.id) : [];
  const advanceOptions = [...summary.advances, ...freeAdvances].map((a) => ({ id: a.id, label: `${money(a.amountCents)} em ${date(a.date)}, ${a.description}` }));
  const self = `/app/relatorios/${report.id}`;

  return (
    <>
      <Link href="/app/relatorios" className="link mt-4 inline-flex min-h-11 items-center gap-1 font-display text-sm lowercase text-muted">
        <ChevronLeft size={16} aria-hidden="true" /> relatórios
      </Link>
      <h1 className="head text-3xl text-ink">{report.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <ReportBadge stage={summary.stage} />
        <span>centro de custo {report.costCenter || "não informado"}</span>
      </div>

      <dl className="mt-6 grid grid-cols-2 border-y border-rule">
        <div className="py-4 pr-4">
          <dt className="label">total</dt>
          <dd className="figure text-3xl">{money(summary.totalCents)}</dd>
          <dd className="mt-1 text-sm text-muted">{summary.expenses.length} despesa{summary.expenses.length === 1 ? "" : "s"}</dd>
        </div>
        <div className="border-l border-rule py-4 pl-4">
          <dt className="label">a reembolsar</dt>
          <dd className="figure text-3xl">{money(summary.reimbursableCents)}</dd>
          <dd className="mt-1 text-sm text-muted">pago em dinheiro</dd>
        </div>
      </dl>

      {summary.advances.length > 0 && (
        <section className="well mt-4 p-4 text-sm" aria-labelledby="adiantamento">
          <h2 id="adiantamento" className="head text-lg text-ink">adiantamento</h2>
          <p className="mt-1 text-ink-2">
            Recebido {money(summary.advancedCents)}, gasto {money(summary.spentFromAdvanceCents)}.{" "}
            {summary.advanceBalanceCents > 0 && <strong className="font-medium text-ink">Devolver {money(summary.advanceBalanceCents)} à empresa.</strong>}
            {summary.advanceBalanceCents < 0 && <strong className="font-medium text-ink">A empresa deve {money(-summary.advanceBalanceCents)} a você.</strong>}
            {summary.advanceBalanceCents === 0 && <strong className="font-medium text-ink">Acertado, sem saldo.</strong>}
          </p>
        </section>
      )}

      <section className="mt-8" aria-labelledby="despesas">
        <h2 id="despesas" className="head border-b border-rule pb-2 text-xl text-ink">despesas no relatório</h2>
        {summary.expenses.length === 0 ? (
          <p className="pt-4 text-sm text-muted">Nenhuma despesa ainda. Adicione abaixo as despesas sem relatório.</p>
        ) : (
          <ul>
            {summary.expenses.map((e) => (
              <ExpenseCard
                key={e.e.id}
                expense={e}
                now={at}
                icons={icons}
                href={`/app/despesas/${e.e.id}?voltar=${self}`}
                inReport
                footer={
                  open ? (
                    <>
                      <span className="text-error">{e.e.savedAt ? "" : "falta preencher tipo, descrição ou comprovante"}</span>
                      <form action={removeExpenseAction}>
                        <input type="hidden" name="expenseId" value={e.e.id} />
                        <button type="submit" className="inline-flex min-h-9 items-center gap-1 rounded-pill px-3 font-display lowercase text-muted hover:bg-paper-2 hover:text-ink">
                          <X size={14} aria-hidden="true" /> tirar do relatório
                        </button>
                      </form>
                    </>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>

      {open && (
        <>
          <section className="mt-8" aria-labelledby="adicionar">
            <h2 id="adicionar" className="head text-xl text-ink">adicionar despesas</h2>
            {available.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nenhuma despesa sem relatório.</p>
            ) : (
              <form action={addExpensesAction} className="mt-2">
                <input type="hidden" name="reportId" value={report.id} />
                <ul className="border-t border-rule">
                  {available.map((e) => (
                    <li key={e.e.id} className="border-b border-rule">
                      <label className="flex min-h-14 items-center gap-3 py-2 text-sm">
                        <input type="checkbox" name="expenseIds" value={e.e.id} className="h-4 w-4 shrink-0 accent-[var(--color-ink)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">{titleCase(e.e.merchant)}</span>
                          <span className="block text-muted">{date(e.e.purchaseDate)}{e.status === "ignorada" ? ", fora do prazo" : ""}</span>
                        </span>
                        <span className="tabular-nums text-ink">{money(e.e.amountCents)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button type="submit" className="btn-ghost mt-4">adicionar selecionadas</button>
              </form>
            )}
            <Link href={`/app/despesas/nova?relatorio=${report.id}`} className="link mt-4 block font-display text-sm lowercase text-link">lançar despesa manual neste relatório</Link>
          </section>

          <div className="mt-10">
            <SubmitReportButton action={submitReportAction} reportId={report.id} disabled={summary.expenses.length === 0} />
          </div>

          <details className="mt-6 border-t border-rule pt-4">
            <summary className="cursor-pointer font-display text-sm lowercase text-muted">editar dados do relatório</summary>
            <div className="mt-4">
              <ReportForm
                action={updateReportAction}
                reportId={report.id}
                defaults={{ name: report.name, costCenter: report.costCenter, notes: report.notes, advanceIds: summary.advances.map((a) => a.id) }}
                advances={advanceOptions}
                submitLabel="salvar"
              />
            </div>
          </details>
        </>
      )}

      {report.notes && !open && <p className="mt-6 text-sm text-ink-2">Observações: {report.notes}</p>}
    </>
  );
}
