import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { employees } from "@/db/schema";
import { now } from "@/lib/clock";
import { listAllAdvances } from "@/lib/reports";
import { date, money } from "@/lib/format";
import { REPORT_STAGE_LABELS } from "@/lib/status";
import { PageTitle } from "@/components/page-title";
import { AdvanceForm } from "./advance-form";

export default async function AdvancesPage() {
  const db = await getDb();
  const people = await db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.role, "funcionario")).orderBy(asc(employees.name)).all();
  const rows = await listAllAdvances(db);
  return (
    <>
      <PageTitle title="adiantamentos" subtitle="Dinheiro entregue antes da despesa. O funcionário vincula ao relatório e o saldo é acertado nele." />
      <section className="well p-5" aria-labelledby="novo">
        <h2 id="novo" className="head mb-4 text-xl text-ink">novo adiantamento</h2>
        <AdvanceForm people={people} today={(await now(db)).toISOString().slice(0, 10)} />
      </section>
      <div className="mt-10 overflow-x-auto">
        <table className="data-table min-w-[720px]">
          <thead><tr><th scope="col">data</th><th scope="col">funcionário</th><th scope="col">para que é</th><th scope="col" className="text-right">valor</th><th scope="col">relatório</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="py-6 text-muted">Nenhum adiantamento registrado.</td></tr>}
            {rows.map(({ a, employee, report, reportStatus }) => (
              <tr key={a.id}>
                <td className="tabular-nums">{date(a.date)}</td>
                <td>{employee}</td>
                <td>{a.description}</td>
                <td className="text-right tabular-nums">{money(a.amountCents)}</td>
                <td>
                  {report ? (
                    reportStatus === "aberto" ? `${report} (aberto)` : <Link className="link text-link" href={`/admin/aprovacoes/${a.reportId}`}>{report}, {REPORT_STAGE_LABELS[reportStatus === "aprovado" ? "aprovado" : "em_aprovacao"]}</Link>
                  ) : (
                    <span className="text-muted">ainda não acertado</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
