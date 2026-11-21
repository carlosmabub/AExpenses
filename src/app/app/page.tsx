import Link from "next/link";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { money, timeLeft } from "@/lib/format";
import { ExpenseCard } from "@/components/expense-card";

export default async function EmployeeHome() {
  const user = await requireUser();
  const db = getDb();
  const at = now(db);
  const icons = new Map(listCategories(db, false).map((c) => [c.id, c.icon]));
  const expenses = listEmployeeExpenses(db, user.id);
  const pending = expenses.filter((e) => e.status === "pendente").sort((a, b) => a.tx.dueAt.localeCompare(b.tx.dueAt));
  const ignored = expenses.filter((e) => e.status === "ignorada");
  const monthPrefix = at.toISOString().slice(0, 7);
  const monthTotal = expenses
    .filter((e) => e.tx.kind !== "estorno" && (e.tx.purchaseDate ?? "").startsWith(monthPrefix))
    .reduce((s, e) => s + e.tx.amountCents, 0);

  return (
    <>
      <header className="bg-brand-600 px-4 pb-14 pt-6 text-white">
        <p className="text-sm text-brand-100">Olá,</p>
        <h1 className="text-2xl font-bold">{user.name.split(" ")[0]} 👋</h1>
      </header>

      <section className="-mt-10 space-y-4 px-4">
        <div className="card grid grid-cols-2 divide-x divide-slate-100 p-4">
          <div>
            <p className="text-xs text-slate-500">Para classificar</p>
            <p className="text-3xl font-bold text-slate-900">{pending.length}</p>
            {pending[0] && <p className="text-xs font-medium text-amber-600">próxima {timeLeft(pending[0].tx.dueAt, at)}</p>}
          </div>
          <div className="pl-4">
            <p className="text-xs text-slate-500">Gasto no mês</p>
            <p className="text-xl font-bold text-slate-900">{money(monthTotal)}</p>
            <p className="text-xs text-slate-500">{expenses.length} lançamentos no total</p>
          </div>
        </div>

        {ignored.length > 0 && (
          <Link href="/app/despesas?aba=ignoradas" className="card flex items-center gap-3 bg-red-50 p-3 ring-red-200">
            <span className="text-xl">⚠️</span>
            <p className="text-sm text-red-800">
              <strong>{ignored.length}</strong> despesa{ignored.length > 1 ? "s passaram" : " passou"} do prazo e
              {ignored.length > 1 ? " foram enviadas" : " foi enviada"} ao financeiro. Você ainda pode classificar.
            </p>
          </Link>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Do que se tratam essas compras?</h2>
            <Link href="/app/despesas" className="text-sm font-medium text-brand-600">Ver todas</Link>
          </div>
          {pending.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-500">
              <p className="text-3xl">🎉</p>
              Tudo em dia! Quando uma compra nova chegar do banco, ela aparece aqui.
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map((e) => (
                <ExpenseCard key={e.tx.id} expense={e} now={at} icons={icons} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
