import Link from "next/link";
import { eq } from "drizzle-orm";
import { TriangleAlert, UserRound } from "lucide-react";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { clockMode, now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { listEmployeeReports } from "@/lib/reports";
import { date, money } from "@/lib/format";
import { isApprover, teamAlerts } from "@/lib/people";
import { ExpenseRow, ReportRow, SectionCard } from "@/components/mobile/rows";
import { CorporateCard } from "@/components/mobile/corporate-card";

export default async function EmployeeHome() {
  const user = await requireUser();
  const db = await getDb();
  // tudo independente: vai ao banco ao mesmo tempo
  const [at, categoryList, expenses, allReports, [card], mode] = await Promise.all([
    now(db),
    listCategories(db, false),
    listEmployeeExpenses(db, user.id),
    listEmployeeReports(db, user.id),
    db.select().from(cards).where(eq(cards.employeeId, user.id)).all(),
    clockMode(db),
  ]);
  const icons = new Map(categoryList.map((c) => [c.id, c.icon]));
  const withoutReport = expenses.filter((e) => e.status === "sem_relatorio" || e.status === "ignorada");
  const late = withoutReport.filter((e) => e.status === "ignorada").length;
  const returned = expenses.filter((e) => e.status === "devolvida");
  const reports = allReports.filter((r) => r.stage !== "aprovado");
  const simulated = mode === "simulado";
  const alerts = isApprover(user) ? await teamAlerts(db, user.id, at) : [];

  return (
    <>
      <header className="-mx-4 bg-ink px-4 pb-24 pt-5 text-accent-ink">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-pill bg-white/15">
            <UserRound size={22} aria-hidden="true" />
          </span>
          <h1 className="text-lg">Olá, {user.name.split(" ")[0]}</h1>
        </div>
        {simulated && <p className="mt-2 text-xs opacity-70">Piloto: hoje é {date(at.toISOString())}</p>}
      </header>

      {card ? (
        <div className="relative -mt-20">
          <CorporateCard last4={card.last4} holder={card.holderName} company="ASTEC" />
        </div>
      ) : (
        <div className="-mt-20 h-16" />
      )}

      <div className="mt-6 space-y-3">
        {alerts.length > 0 && (
          <Link href="/equipe" className="surface-card flex items-start gap-3 p-4">
            <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
            <span className="text-sm text-ink">
              <span className="block font-medium">Despesas da equipe vencendo neste mês</span>
              {alerts.slice(0, 3).map((a) => <span key={a.person.id} className="block text-ink-2">{a.person.name}: {a.count} ({money(a.totalCents)})</span>)}
              {alerts.length > 3 && <span className="block text-muted">e mais {alerts.length - 3}</span>}
            </span>
          </Link>
        )}
        {returned.length > 0 && (
          <SectionCard title="Devolvidas para corrigir" count={returned.length} href="/app/despesas?aba=devolvidas" open>
            <ul>{returned.slice(0, 3).map((e) => <ExpenseRow key={e.e.id} expense={e} href={`/app/despesas/${e.e.id}?voltar=/app`} icons={icons} />)}</ul>
          </SectionCard>
        )}

        <SectionCard title="Despesas sem relatório" count={withoutReport.length} href="/app/despesas">
          {withoutReport.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">Nenhuma despesa sem relatório.</p>
          ) : (
            <ul>{withoutReport.slice(0, 3).map((e) => <ExpenseRow key={e.e.id} expense={e} href={`/app/despesas/${e.e.id}?voltar=/app`} icons={icons} />)}</ul>
          )}
          {late > 0 && (
            <Link href="/app/despesas?aba=sem-relatorio" className="block border-t border-rule px-4 py-3 text-sm text-error">
              {late} passaram do prazo do mês. Coloque num relatório e envie.
            </Link>
          )}
        </SectionCard>

        <SectionCard title="Relatórios pendentes" count={reports.length} href="/app/relatorios">
          {reports.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">Nenhum relatório pendente. Crie um pelo botão +.</p>
          ) : (
            <ul>{reports.slice(0, 3).map((r) => <ReportRow key={r.report.id} summary={r} />)}</ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
