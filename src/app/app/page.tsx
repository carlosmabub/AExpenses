import Link from "next/link";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { money, timeLeft } from "@/lib/format";
import { ExpenseCard } from "@/components/expense-card";

export default async function EmployeeHome() {
  const user = await requireUser();
  const db = await getDb();
  const at = await now(db);
  const icons = new Map((await listCategories(db, false)).map((c) => [c.id, c.icon]));
  const expenses = await listEmployeeExpenses(db, user.id);
  const pending = expenses.filter((e) => e.status === "pendente").sort((a, b) => a.tx.dueAt.localeCompare(b.tx.dueAt));
  const ignored = expenses.filter((e) => e.status === "ignorada");
  const monthPrefix = at.toISOString().slice(0, 7);
  const monthTotal = expenses
    .filter((e) => e.tx.kind !== "estorno" && (e.tx.purchaseDate ?? "").startsWith(monthPrefix))
    .reduce((s, e) => s + e.tx.amountCents, 0);

  return (
    <>
      <h1 className="head pt-6 text-3xl text-ink">olá, {user.name.split(" ")[0].toLowerCase()}</h1>

      <dl className="mt-6 grid grid-cols-2 border-y border-rule">
        <div className="py-4 pr-4">
          <dt className="label">para classificar</dt>
          <dd className="figure text-accent">{pending.length}</dd>
          {pending[0] && <dd className="mt-1 text-sm text-muted">a próxima {timeLeft(pending[0].tx.dueAt, at)}</dd>}
        </div>
        <div className="border-l border-rule py-4 pl-4">
          <dt className="label">gasto no mês</dt>
          <dd className="figure text-2xl">{money(monthTotal)}</dd>
          <dd className="mt-1 text-sm text-muted">{expenses.length} lançamentos no total</dd>
        </div>
      </dl>

      {ignored.length > 0 && (
        <Link href="/app/despesas?aba=ignoradas" className="well mt-4 block p-4 text-sm text-ink-2 hover:bg-paper-3">
          <strong className="font-medium text-error">
            {ignored.length} despesa{ignored.length > 1 ? "s passaram" : " passou"} do prazo
          </strong>{" "}
          e {ignored.length > 1 ? "foram enviadas" : "foi enviada"} ao financeiro. Você ainda pode classificar.
        </Link>
      )}

      <section className="mt-8" aria-labelledby="fila">
        <div className="flex items-baseline justify-between">
          <h2 id="fila" className="head text-xl text-ink">do que se tratam essas compras?</h2>
          <Link href="/app/despesas" className="link shrink-0 font-display text-sm lowercase text-accent">ver todas</Link>
        </div>
        {pending.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-sm text-muted">
            Tudo em dia. Quando uma compra nova chegar do banco, ela aparece aqui.
          </p>
        ) : (
          <ul className="mt-2 border-t border-rule">
            {pending.map((e) => (
              <ExpenseCard key={e.tx.id} expense={e} now={at} icons={icons} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
