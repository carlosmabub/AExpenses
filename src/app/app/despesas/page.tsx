import Link from "next/link";
import { Search } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { listCategories, listEmployeeExpenses } from "@/lib/expenses";
import type { ExpenseStatus } from "@/lib/status";
import { TopBar } from "@/components/mobile/top-bar";
import { ExpenseRow } from "@/components/mobile/rows";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const { aba, q = "" } = await searchParams;
  const user = await requireUser();
  const db = await getDb();
  const icons = new Map((await listCategories(db, false)).map((c) => [c.id, c.icon]));
  const all = await listEmployeeExpenses(db, user.id);
  const returned = all.filter((e) => e.status === "devolvida").length;
  const tabs: { key: string; label: string; statuses?: ExpenseStatus[] }[] = [
    { key: "sem-relatorio", label: "Sem relatório", statuses: ["sem_relatorio", "ignorada"] },
    ...(returned ? [{ key: "devolvidas", label: "Devolvidas", statuses: ["devolvida"] as ExpenseStatus[] }] : []),
    { key: "todas", label: "Todas" },
  ];
  const tab = tabs.find((t) => t.key === aba) ?? tabs[0];
  const term = q.trim().toLowerCase();
  const items = all
    .filter((e) => !tab.statuses || tab.statuses.includes(e.status))
    .filter((e) => !term || `${e.e.merchant} ${e.category?.name ?? ""} ${e.e.description}`.toLowerCase().includes(term));

  return (
    <>
      <TopBar title="Despesas" back="/app/menu" />
      <nav aria-label="Filtrar despesas" className="-mt-3 flex rounded-pill bg-surface p-1 shadow-card">
        {tabs.map((t) => {
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/app/despesas?aba=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 flex-1 items-center justify-center rounded-pill text-sm transition-colors duration-100 ${active ? "bg-ink text-accent-ink" : "text-muted hover:text-ink"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <form className="relative mt-3" role="search">
        <input type="hidden" name="aba" value={tab.key} />
        <label htmlFor="q" className="visually-hidden">Pesquisar despesa</label>
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Pesquisar despesa…" className="input bg-surface pl-11 shadow-none" />
      </form>
      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">{term ? "Nada encontrado com essa pesquisa." : "Nenhuma despesa aqui."}</p>
      ) : (
        <ul className="surface-card mt-3 overflow-hidden">
          {items.map((e) => <ExpenseRow key={e.e.id} expense={e} href={`/app/despesas/${e.e.id}?voltar=/app/despesas?aba=${tab.key}`} icons={icons} showStatus={tab.key !== "sem-relatorio"} />)}
        </ul>
      )}
    </>
  );
}
