import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { PageTitle } from "@/components/page-title";
import { StatusBadge, ReportBadge } from "@/components/status-badge";
import { now } from "@/lib/clock";
import { listAdminExpenses } from "@/lib/expenses";
import { date, money, titleCase } from "@/lib/format";
import { getPerson, hasHistory, ROLE_LABELS } from "@/lib/people";
import { listEmployeeReports } from "@/lib/reports";
import { formData } from "../data";
import { PersonActions } from "../person-actions";
import { PersonForm } from "../person-form";

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const id = Number((await params).id);
  const saved = (await searchParams).salvo === "1";
  const db = await getDb();
  const person = await getPerson(db, id);
  if (!person) notFound();
  const [data, expenses, reports, history, today] = await Promise.all([
    formData(db, id),
    listAdminExpenses(db, { employeeId: id }),
    listEmployeeReports(db, id),
    hasHistory(db, id),
    now(db),
  ]);
  const real = expenses.filter((r) => r.e.kind !== "estorno");
  const total = real.reduce((s, r) => s + r.e.amountCents, 0);
  const count = (status: string) => real.filter((r) => r.status === status).length;

  return (
    <>
      <Link href="/admin/cadastro" className="link mb-2 inline-flex min-h-10 items-center gap-1 font-display text-sm lowercase text-muted"><ChevronLeft size={16} aria-hidden="true" /> usuários</Link>
      <PageTitle title={person.name} subtitle={person.active ? ROLE_LABELS[person.role] : `Desligado em ${date(person.terminatedAt)}. O histórico continua visível para os administradores.`} />
      {saved && <p className="mb-6 text-ink" role="status">Cadastro salvo.</p>}

      <PersonForm
        key={`${person.id}-${person.role}-${person.leaderId}`}
        person={{ id: person.id, name: person.name, email: person.email, role: person.role, costCenter: person.costCenter, leaderId: person.leaderId, active: person.active }}
        {...data}
      />
      <PersonActions id={person.id} active={person.active} canDelete={!history && person.role !== "admin"} today={today.toISOString().slice(0, 10)} />

      <section className="mt-12 border-t border-rule pt-6" aria-labelledby="historico">
        <h2 id="historico" className="head text-xl text-ink">histórico</h2>
        <dl className="mt-4 grid border-y border-rule sm:grid-cols-4">
          <div className="py-4 pr-6"><dt className="label">total gasto</dt><dd className="figure text-3xl">{money(total)}</dd></div>
          <div className="py-4 pr-6 sm:border-l sm:border-rule sm:pl-6"><dt className="label">despesas</dt><dd className="figure text-3xl">{real.length}</dd></div>
          <div className="py-4 pr-6 sm:border-l sm:border-rule sm:pl-6"><dt className="label">aprovadas</dt><dd className="figure text-3xl">{count("aprovada")}</dd></div>
          <div className="py-4 sm:border-l sm:border-rule sm:pl-6"><dt className="label">ignoradas</dt><dd className="figure text-3xl">{count("ignorada")}</dd></div>
        </dl>

        <h3 className="head mt-8 text-lg text-ink">relatórios</h3>
        {reports.length === 0 ? <p className="mt-2 text-sm text-muted">Nenhum relatório.</p> : (
          <ul className="mt-2 border-t border-rule">
            {reports.map((r) => (
              <li key={r.report.id} className="flex flex-wrap items-center gap-3 border-b border-rule py-3">
                {r.report.status === "aberto" ? <span className="text-ink">{r.report.name}</span> : <Link href={`/admin/aprovacoes/${r.report.id}`} className="link text-link">{r.report.name}</Link>}
                <ReportBadge stage={r.stage} />
                <span className="ml-auto tabular-nums text-ink">{money(r.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="head mt-8 text-lg text-ink">despesas</h3>
        {real.length === 0 ? <p className="mt-2 text-sm text-muted">Nenhuma despesa.</p> : (
          <div className="mt-2 overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead><tr><th scope="col">data</th><th scope="col">estabelecimento</th><th scope="col">tipo</th><th scope="col">relatório</th><th scope="col">status</th><th scope="col" className="text-right">valor</th></tr></thead>
              <tbody>
                {real.map((r) => (
                  <tr key={r.e.id}>
                    <td>{date(r.e.purchaseDate)}</td>
                    <td><Link href={`/admin/transacoes/${r.e.id}`} className="link text-link">{titleCase(r.e.merchant)}</Link></td>
                    <td>{r.category?.name ?? <span className="text-muted">não informado</span>}</td>
                    <td>{r.report?.name ?? <span className="text-muted">sem relatório</span>}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-right tabular-nums">{money(r.e.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
