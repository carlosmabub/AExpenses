import Link from "next/link";
import { Download, Paperclip } from "lucide-react";
import { getDb } from "@/db";
import { displayName, listPeople } from "@/lib/people";
import { listAdminExpenses, listCategories } from "@/lib/expenses";
import { date, installmentLabel, money, titleCase } from "@/lib/format";
import type { ExpenseStatus } from "@/lib/status";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/status";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { CategoryIcon } from "@/components/category-icon";

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
  const people = await listPeople(db);
  const cats = await listCategories(db, false);
  const total = rows.filter((r) => r.e.kind !== "estorno").reduce((s, r) => s + r.e.amountCents, 0);
  const exportQuery = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageTitle title="despesas" subtitle={`${rows.length} lançamentos, ${money(total)}`}>
        <a href={`/admin/exportar/arquivo?${exportQuery}`} className="btn-ghost">
          <Download size={16} aria-hidden="true" /> exportar em excel
        </a>
      </PageTitle>

      <form className="well mb-8 grid grid-cols-2 items-end gap-4 p-5 md:grid-cols-6" aria-label="Filtros">
        <div className="md:col-span-2">
          <label className="label" htmlFor="f-funcionario">funcionário</label>
          <select id="f-funcionario" name="funcionario" defaultValue={sp.funcionario ?? ""} className="input">
            <option value="">todos</option>
            {people.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-status">status</label>
          <select id="f-status" name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-categoria">tipo</label>
          <select id="f-categoria" name="categoria" defaultValue={sp.categoria ?? ""} className="input">
            <option value="">todas</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-de">de</label>
          <input id="f-de" type="date" name="de" defaultValue={sp.de} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="f-ate">até</label>
          <input id="f-ate" type="date" name="ate" defaultValue={sp.ate} className="input" />
        </div>
        <div className="col-span-2 flex items-center gap-4 md:col-span-6">
          <button type="submit" className="btn-primary">filtrar</button>
          <Link href="/admin/transacoes" className="link font-display text-sm lowercase text-muted">limpar filtros</Link>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[920px]">
          <thead>
            <tr>
              <th scope="col">data</th>
              <th scope="col">funcionário</th>
              <th scope="col">estabelecimento</th>
              <th scope="col">preenchimento</th>
              <th scope="col" className="text-right">valor</th>
              <th scope="col">status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-muted">Nenhuma despesa com esses filtros.</td></tr>}
            {rows.map((r) => {
              const parcel = r.tx ? installmentLabel(r.tx.installment, r.tx.installmentsTotal) : null;
              return (
                <tr key={r.e.id}>
                  <td className="whitespace-nowrap tabular-nums">{date(r.e.purchaseDate)}</td>
                  <td>
                    {r.owner?.name ?? <span className="text-error">{r.card?.holderName}, não vinculado</span>}
                    <span className="block text-muted">{PAYMENT_LABELS[r.e.paymentMethod]}{r.card ? `, final ${r.card.last4}` : ""}</span>
                  </td>
                  <td>
                    <Link href={`/admin/transacoes/${r.e.id}`} className="link font-medium text-ink">{titleCase(r.e.merchant)}</Link>
                    <span className="block text-muted">
                      {[r.e.city && titleCase(r.e.city), r.tx && titleCase(r.tx.activityDescription).toLowerCase(), parcel?.toLowerCase()].filter(Boolean).join(", ")}
                    </span>
                  </td>
                  <td>
                    {r.category ? (
                      <>
                        <span className="flex items-center gap-2 text-ink"><CategoryIcon name={r.category.icon} size={16} className="text-muted" />{r.category.name}</span>
                        <span className="block max-w-xs truncate text-muted">{r.e.description}</span>
                      </>
                    ) : (
                      <span className="text-muted">não preenchida</span>
                    )}
                    {r.report && <span className="block text-muted">relatório: {r.report.name}</span>}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">{money(r.e.amountCents)}</td>
                  <td>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
                      {r.e.receiptPath && <Paperclip size={14} aria-label="Com comprovante" className="text-muted" />}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
