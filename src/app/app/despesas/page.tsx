import Link from "next/link";
import { Search } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import { ExpenseCard } from "@/components/expense-card";
import type { ExpenseStatus } from "@/lib/status";

const TABS: { key: string; label: string; statuses?: ExpenseStatus[] }[] = [
  { key: "sem-relatorio", label: "sem relatório", statuses: ["sem_relatorio"] },
  { key: "devolvidas", label: "devolvidas", statuses: ["devolvida"] },
  { key: "ignoradas", label: "ignoradas", statuses: ["ignorada"] },
  { key: "todas", label: "todas" },
];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const { aba, q = "" } = await searchParams;
  const tab = TABS.find((t) => t.key === aba) ?? TABS[0];
  const user = await requireUser();
  const db = await getDb();
  const at = await now(db);
  const icons = new Map((await listCategories(db, false)).map((c) => [c.id, c.icon]));
  const all = await listEmployeeExpenses(db, user.id);
  const term = q.trim().toLowerCase();
  const items = all
    .filter((e) => !tab.statuses || tab.statuses.includes(e.status))
    .filter((e) => !term || `${e.e.merchant} ${e.category?.name ?? ""} ${e.e.description}`.toLowerCase().includes(term));

  return (
    <>
      <h1 className="head pt-6 text-3xl text-ink">despesas</h1>
      <form className="relative mt-5" role="search">
        <input type="hidden" name="aba" value={tab.key} />
        <label htmlFor="q" className="visually-hidden">Pesquisar despesa</label>
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Pesquisar despesa" className="input pl-11" />
      </form>
      <nav aria-label="Filtrar despesas" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const count = t.statuses ? all.filter((e) => t.statuses!.includes(e.status)).length : all.length;
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/app/despesas?aba=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={`pill min-h-9 shrink-0 px-4 text-sm transition-colors duration-100 ${active ? "bg-ink text-paper shadow-none" : "hover:bg-paper-2"}`}
            >
              {t.label} <span className="tabular-nums">{count}</span>
            </Link>
          );
        })}
      </nav>
      {items.length === 0 ? (
        <p className="mt-6 border-t border-rule pt-4 text-sm text-muted">{term ? "Nada encontrado com essa pesquisa." : "Nenhuma despesa aqui."}</p>
      ) : (
        <ul className="mt-4 border-t border-rule">
          {items.map((e) => <ExpenseCard key={e.e.id} expense={e} now={at} icons={icons} />)}
        </ul>
      )}
    </>
  );
}
