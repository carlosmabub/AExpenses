import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { listEmployeeReports } from "@/lib/reports";
import { money } from "@/lib/format";
import { ExpenseCard } from "@/components/expense-card";
import { ReportBadge } from "@/components/status-badge";

function Block({ id, title, count, href, children }: { id: string; title: string; count: number; href: string; children: React.ReactNode }) {
  return (
    <section className="mt-8" aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <h2 id={id} className="head text-xl text-ink">
          {title} <span className="figure text-xl text-muted">{count}</span>
        </h2>
        <Link href={href} className="link shrink-0 font-display text-sm lowercase text-link">ver todas</Link>
      </div>
      {children}
    </section>
  );
}

export default async function EmployeeHome() {
  const user = await requireUser();
  const db = await getDb();
  const at = await now(db);
  const icons = new Map((await listCategories(db, false)).map((c) => [c.id, c.icon]));
  const expenses = await listEmployeeExpenses(db, user.id);
  const withoutReport = expenses.filter((e) => e.status === "sem_relatorio").sort((a, b) => a.e.dueAt.localeCompare(b.e.dueAt));
  const returned = expenses.filter((e) => e.status === "devolvida");
  const ignored = expenses.filter((e) => e.status === "ignorada");
  const reports = (await listEmployeeReports(db, user.id)).filter((r) => r.stage !== "aprovado");
  const [card] = await db.select().from(cards).where(eq(cards.employeeId, user.id)).all();

  return (
    <>
      <h1 className="head pt-6 text-3xl text-ink">olá, {user.name.split(" ")[0].toLowerCase()}</h1>

      {card && (
        <div className="mt-5 flex aspect-[2/1] max-h-44 w-full flex-col justify-between rounded-card bg-ink p-5 text-accent-ink">
          <span className="font-display text-sm lowercase opacity-80">cartão corporativo</span>
          <span className="figure text-3xl tracking-normal">•••• {card.last4}</span>
          <span className="text-sm opacity-80">{user.name}</span>
        </div>
      )}

      {returned.length > 0 && (
        <Block id="devolvidas" title="devolvidas para corrigir" count={returned.length} href="/app/despesas?aba=devolvidas">
          <ul>{returned.slice(0, 3).map((e) => <ExpenseCard key={e.e.id} expense={e} now={at} icons={icons} />)}</ul>
        </Block>
      )}

      <Block id="sem-relatorio" title="despesas sem relatório" count={withoutReport.length} href="/app/despesas">
        {withoutReport.length === 0 ? (
          <p className="pt-4 text-sm text-muted">Tudo em relatório. Quando uma compra nova chegar do banco, ela aparece aqui.</p>
        ) : (
          <ul>{withoutReport.slice(0, 3).map((e) => <ExpenseCard key={e.e.id} expense={e} now={at} icons={icons} />)}</ul>
        )}
        {ignored.length > 0 && (
          <Link href="/app/despesas?aba=ignoradas" className="mt-3 block text-sm text-error link">
            {ignored.length} despesa{ignored.length > 1 ? "s passaram" : " passou"} do prazo e {ignored.length > 1 ? "foram enviadas" : "foi enviada"} ao financeiro. Ainda dá para lançar num relatório.
          </Link>
        )}
      </Block>

      <Block id="relatorios" title="relatórios pendentes" count={reports.length} href="/app/relatorios">
        {reports.length === 0 ? (
          <p className="pt-4 text-sm text-muted">Nenhum relatório pendente. Crie um pelo botão + e lance as despesas nele.</p>
        ) : (
          <ul>
            {reports.slice(0, 3).map((r) => (
              <li key={r.report.id} className="border-b border-rule">
                <Link href={`/app/relatorios/${r.report.id}`} className="flex items-center justify-between gap-3 py-4 hover:bg-paper-2/60">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{r.report.name}</span>
                    <span className="block text-sm text-muted">{r.expenses.length} despesa{r.expenses.length === 1 ? "" : "s"}, {money(r.totalCents)}</span>
                  </span>
                  <ReportBadge stage={r.stage} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}
