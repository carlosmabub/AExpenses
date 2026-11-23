import Link from "next/link";
import { eq } from "drizzle-orm";
import { UserRound } from "lucide-react";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { clockMode, now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { listEmployeeReports } from "@/lib/reports";
import { date } from "@/lib/format";
import { ExpenseRow, ReportRow, SectionCard } from "@/components/mobile/rows";
import { CorporateCard } from "@/components/mobile/corporate-card";

export default async function EmployeeHome() {
  const user = await requireUser();
  const db = await getDb();
  const at = await now(db);
  const icons = new Map((await listCategories(db, false)).map((c) => [c.id, c.icon]));
  const expenses = await listEmployeeExpenses(db, user.id);
  const withoutReport = expenses.filter((e) => e.status === "sem_relatorio" || e.status === "ignorada");
  const late = withoutReport.filter((e) => e.status === "ignorada").length;
  const returned = expenses.filter((e) => e.status === "devolvida");
  const reports = (await listEmployeeReports(db, user.id)).filter((r) => r.stage !== "aprovado");
  const [card] = await db.select().from(cards).where(eq(cards.employeeId, user.id)).all();
  const simulated = (await clockMode(db)) === "simulado";

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
