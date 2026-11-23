import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, HandCoins, Plus, X } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { getReport, openAdvances } from "@/lib/reports";
import { date, money } from "@/lib/format";
import { REPORT_STAGE_LABELS } from "@/lib/status";
import { TopBar } from "@/components/mobile/top-bar";
import { ExpenseRow } from "@/components/mobile/rows";
import { ReportForm, SubmitReportButton } from "../report-form";
import { addExpensesAction, removeExpenseAction, submitReportAction, updateReportAction } from "../actions";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const db = await getDb();
  const summary = await getReport(db, Number((await params).id));
  if (!summary || summary.report.employeeId !== user.id) notFound();
  const { report } = summary;
  const icons = new Map((await listCategories(db, false)).map((c) => [c.id, c.icon]));
  const open = report.status === "aberto";
  const available = open ? (await listEmployeeExpenses(db, user.id)).filter((e) => e.status === "sem_relatorio" || e.status === "ignorada") : [];
  const freeAdvances = open ? await openAdvances(db, user.id) : [];
  const advanceOptions = [...summary.advances, ...freeAdvances].map((a) => ({ id: a.id, label: `${money(a.amountCents)} em ${date(a.date)}, ${a.description}` }));
  const self = `/app/relatorios/${report.id}`;
  const balance = summary.advanceBalanceCents;

  return (
    <>
      <TopBar title={report.name} back="/app/relatorios">
        <p className="figure mt-4 text-center text-4xl">{money(summary.totalCents)}</p>
        <p className="mt-1 text-center text-sm opacity-80">
          {summary.expenses.length} despesa{summary.expenses.length === 1 ? "" : "s"}, {REPORT_STAGE_LABELS[summary.stage]}
        </p>
      </TopBar>

      {summary.advances.length > 0 && (
        <section className="surface-card -mt-4 px-4">
          <div className="form-row border-b-0">
            <HandCoins size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            <span className="shrink-0">Adiantamento</span>
            <span className="flex-1 text-right text-sm text-muted">
              {money(summary.advancedCents)} recebido,{" "}
              {balance > 0 ? `devolver ${money(balance)}` : balance < 0 ? `a receber ${money(-balance)}` : "acertado"}
            </span>
          </div>
        </section>
      )}

      <h2 className="mb-2 mt-4 px-1 text-ink">Despesas</h2>
      {summary.expenses.length === 0 ? (
        <p className="surface-card px-4 py-4 text-sm text-muted">Nenhuma despesa ainda.</p>
      ) : (
        <ul className="surface-card overflow-hidden">
          {summary.expenses.map((e) => (
            <ExpenseRow
              key={e.e.id}
              expense={e}
              href={`/app/despesas/${e.e.id}?voltar=${self}`}
              icons={icons}
              showStatus={!open}
              footer={
                open ? (
                  <>
                    <ul className="space-y-1 text-error">
                      {!e.e.savedAt && !e.e.categoryId && (
                        <li className="flex items-center gap-1.5"><CircleAlert size={14} aria-hidden="true" /> Tipo não informado</li>
                      )}
                      {!e.e.savedAt && !e.e.receiptPath && (
                        <li className="flex items-center gap-1.5"><CircleAlert size={14} aria-hidden="true" /> Comprovante não anexado</li>
                      )}
                    </ul>
                    <form action={removeExpenseAction}>
                      <input type="hidden" name="expenseId" value={e.e.id} />
                      <button type="submit" className="inline-flex min-h-9 items-center gap-1 rounded-pill px-2 text-muted hover:bg-paper-2 hover:text-ink">
                        <X size={14} aria-hidden="true" /> Tirar
                      </button>
                    </form>
                  </>
                ) : undefined
              }
            />
          ))}
        </ul>
      )}

      {open && (
        <>
          {available.length > 0 && (
            <details className="surface-card group mt-3 overflow-hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-link [&::-webkit-details-marker]:hidden">
                <Plus size={20} aria-hidden="true" /> Adicionar despesas sem relatório
                <span className="ml-auto inline-flex h-7 min-w-7 items-center justify-center rounded-pill bg-accent-soft px-2 text-sm tabular-nums text-ink">{available.length}</span>
              </summary>
              <form action={addExpensesAction} className="border-t border-rule">
                <input type="hidden" name="reportId" value={report.id} />
                <ul>
                  {available.map((e) => (
                    <li key={e.e.id} className="border-b border-rule">
                      <label className="flex min-h-14 items-center gap-3 px-4 py-2 text-sm">
                        <input type="checkbox" name="expenseIds" value={e.e.id} className="h-4 w-4 shrink-0 accent-[var(--color-ink)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">{e.e.merchant}</span>
                          <span className="block text-muted">{date(e.e.purchaseDate)}</span>
                        </span>
                        <span className="tabular-nums text-ink">{money(e.e.amountCents)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="p-4"><button type="submit" className="btn-ghost w-full normal-case">Adicionar selecionadas</button></div>
              </form>
            </details>
          )}
          <Link href={`/app/despesas/nova?relatorio=${report.id}`} className="surface-card mt-3 flex min-h-14 items-center gap-3 px-4 text-link">
            <Plus size={20} aria-hidden="true" /> Lançar despesa manual
          </Link>

          <div className="mt-6">
            <SubmitReportButton action={submitReportAction} reportId={report.id} disabled={summary.expenses.length === 0} />
          </div>

          <details className="surface-card mt-2 overflow-hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center px-4 text-muted [&::-webkit-details-marker]:hidden">Editar dados do relatório</summary>
            <div className="border-t border-rule px-4 pb-4">
              <ReportForm
                action={updateReportAction}
                reportId={report.id}
                defaults={{ name: report.name, costCenter: report.costCenter, notes: report.notes, advanceIds: summary.advances.map((a) => a.id) }}
                advances={advanceOptions}
                submitLabel="Salvar"
              />
            </div>
          </details>
        </>
      )}

      {report.notes && !open && <p className="surface-card mt-3 p-4 text-sm text-ink-2">{report.notes}</p>}
    </>
  );
}
