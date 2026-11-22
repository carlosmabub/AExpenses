import Link from "next/link";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { ExpenseCard } from "@/components/expense-card";
import type { ExpenseStatus } from "@/lib/status";

const TABS: { key: string; label: string; statuses: ExpenseStatus[] }[] = [
  { key: "pendentes", label: "Pendentes", statuses: ["pendente"] },
  { key: "classificadas", label: "Classificadas", statuses: ["classificada", "estorno"] },
  { key: "ignoradas", label: "Ignoradas", statuses: ["ignorada"] },
];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const tab = TABS.find((t) => t.key === aba) ?? TABS[0];
  const user = await requireUser();
  const db = await getDb();
  const at = await now(db);
  const icons = new Map((await listCategories(db, false)).map((c) => [c.id, c.icon]));
  const all = await listEmployeeExpenses(db, user.id);
  const items = all.filter((e) => tab.statuses.includes(e.status));

  return (
    <>
      <header className="sticky top-0 z-10 bg-white px-4 pt-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Minhas despesas</h1>
        <div className="mt-3 flex gap-4">
          {TABS.map((t) => {
            const count = all.filter((e) => t.statuses.includes(e.status)).length;
            const active = t.key === tab.key;
            return (
              <Link key={t.key} href={`/app/despesas?aba=${t.key}`} className={`border-b-2 pb-2 text-sm ${active ? "border-brand-600 font-semibold text-brand-600" : "border-transparent text-slate-500"}`}>
                {t.label} <span className="text-xs">({count})</span>
              </Link>
            );
          })}
        </div>
      </header>
      <section className="space-y-2 p-4">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Nenhuma despesa aqui.</p>
        ) : (
          items.map((e) => <ExpenseCard key={e.tx.id} expense={e} now={at} icons={icons} />)
        )}
      </section>
    </>
  );
}
