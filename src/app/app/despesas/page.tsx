import Link from "next/link";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { ExpenseCard } from "@/components/expense-card";
import type { ExpenseStatus } from "@/lib/status";

const TABS: { key: string; label: string; statuses: ExpenseStatus[] }[] = [
  { key: "pendentes", label: "pendentes", statuses: ["pendente"] },
  { key: "classificadas", label: "classificadas", statuses: ["classificada", "estorno"] },
  { key: "ignoradas", label: "ignoradas", statuses: ["ignorada"] },
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
      <h1 className="head pt-6 text-3xl text-ink">minhas despesas</h1>
      <nav aria-label="Filtrar despesas" className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const count = all.filter((e) => t.statuses.includes(e.status)).length;
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/app/despesas?aba=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={`pill min-h-9 px-4 text-sm transition-colors duration-100 ${active ? "bg-ink text-paper shadow-none" : "hover:bg-paper-2"}`}
            >
              {t.label} <span className="tabular-nums">{count}</span>
            </Link>
          );
        })}
      </nav>
      {items.length === 0 ? (
        <p className="mt-6 border-t border-rule pt-4 text-sm text-muted">Nenhuma despesa {tab.label} por enquanto.</p>
      ) : (
        <ul className="mt-4 border-t border-rule">
          {items.map((e) => (
            <ExpenseCard key={e.tx.id} expense={e} now={at} icons={icons} />
          ))}
        </ul>
      )}
    </>
  );
}
