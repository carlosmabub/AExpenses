import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { employees } from "@/db/schema";
import { listAdminExpenses, listCategories } from "@/lib/expenses";
import { date, installmentLabel, money, titleCase } from "@/lib/format";
import type { ExpenseStatus } from "@/lib/status";
import { classifiedLate } from "@/lib/status";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";

type Search = { funcionario?: string; status?: string; categoria?: string; de?: string; ate?: string; sem_vinculo?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const db = await getDb();
  const rows = await listAdminExpenses(db, {
    employeeId: Number(sp.funcionario) || undefined,
    status: (sp.status || undefined) as ExpenseStatus | undefined,
    categoryId: Number(sp.categoria) || undefined,
    from: sp.de || undefined,
    to: sp.ate || undefined,
    unlinked: sp.sem_vinculo === "1",
  });
  const people = await db.select().from(employees).where(eq(employees.role, "funcionario")).orderBy(asc(employees.name)).all();
  const cats = await listCategories(db, false);
  const total = rows.filter((r) => r.tx.kind !== "estorno").reduce((s, r) => s + r.tx.amountCents, 0);
  const exportQuery = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageTitle title="Despesas" subtitle={`${rows.length} lançamentos · ${money(total)}`}>
        <a href={`/admin/exportar/arquivo?${exportQuery}`} className="btn-ghost">📤 Exportar filtro em Excel</a>
      </PageTitle>

      <form className="card mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="label">Funcionário</label>
          <select name="funcionario" defaultValue={sp.funcionario ?? ""} className="input">
            <option value="">Todos</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="classificada">Classificada</option>
            <option value="ignorada">Ignorada</option>
            <option value="estorno">Estorno</option>
          </select>
        </div>
        <div>
          <label className="label">Categoria</label>
          <select name="categoria" defaultValue={sp.categoria ?? ""} className="input">
            <option value="">Todas</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">De</label>
          <input type="date" name="de" defaultValue={sp.de} className="input" />
        </div>
        <div>
          <label className="label">Até</label>
          <input type="date" name="ate" defaultValue={sp.ate} className="input" />
        </div>
        <div className="col-span-2 flex items-center gap-3 md:col-span-6">
          <button className="btn-primary">Filtrar</button>
          <Link href="/admin/transacoes" className="text-sm text-slate-500 underline">Limpar</Link>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-3 py-2">Funcionário</th>
              <th className="px-3 py-2">Estabelecimento</th>
              <th className="px-3 py-2">Categoria · descrição</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma despesa encontrada.</td></tr>}
            {rows.map((r) => (
              <tr key={r.tx.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 whitespace-nowrap">{date(r.tx.purchaseDate)}</td>
                <td className="px-3 py-2.5">
                  {r.employee?.name ?? <span className="text-amber-700">{r.card.holderName} · não vinculado</span>}
                  <span className="block text-xs text-slate-400">cartão final {r.card.last4}</span>
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/admin/transacoes/${r.tx.id}`} className="font-medium text-slate-800 hover:text-brand-600">{titleCase(r.tx.merchant)}</Link>
                  <span className="block text-xs text-slate-400">
                    {titleCase(r.tx.city)} · {titleCase(r.tx.activityDescription)}
                    {installmentLabel(r.tx.installment, r.tx.installmentsTotal) ? ` · ${installmentLabel(r.tx.installment, r.tx.installmentsTotal)}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {r.classification ? (
                    <>
                      <span>{r.category?.icon} {r.category?.name}</span>
                      <span className="block max-w-xs truncate text-xs text-slate-500">{r.classification.description}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{money(r.tx.amountCents)}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={r.status} />
                  {r.classification && classifiedLate({ kind: r.tx.kind, dueAt: r.tx.dueAt, classifiedAt: r.classification.classifiedAt }) && (
                    <span className="block text-[11px] text-red-500">fora do prazo</span>
                  )}
                  {r.classification?.receiptPath && <span className="block text-[11px] text-slate-400">📎 comprovante</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
