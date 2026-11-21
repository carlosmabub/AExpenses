import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { importBatches } from "@/db/schema";
import { now } from "@/lib/clock";
import { listAdminExpenses, type ExpenseRow } from "@/lib/expenses";
import { dateTime, money } from "@/lib/format";
import { PageTitle } from "@/components/page-title";

function sum(rows: ExpenseRow[]) {
  return rows.reduce((s, r) => s + r.tx.amountCents, 0);
}

function Kpi({ label, value, hint, tone = "slate", href }: { label: string; value: string; hint?: string; tone?: string; href?: string }) {
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  const body = (
    <div className="card h-full p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function Dashboard() {
  const db = getDb();
  const rows = listAdminExpenses(db).filter((r) => r.tx.kind !== "estorno");
  const by = (s: string) => rows.filter((r) => r.status === s);
  const classified = by("classificada");
  const pending = by("pendente");
  const ignored = by("ignorada");
  const pct = rows.length ? Math.round((classified.length / rows.length) * 100) : 0;

  const perEmployee = new Map<string, { id?: number; name: string; rows: ExpenseRow[] }>();
  for (const r of rows) {
    const key = r.employee ? String(r.employee.id) : `card-${r.card.id}`;
    const name = r.employee?.name ?? `${r.card.holderName} (não vinculado)`;
    if (!perEmployee.has(key)) perEmployee.set(key, { id: r.employee?.id, name, rows: [] });
    perEmployee.get(key)!.rows.push(r);
  }
  const employeesRanked = [...perEmployee.values()].sort((a, b) => sum(b.rows) - sum(a.rows));

  const perCategory = new Map<string, { icon: string; cents: number }>();
  for (const r of classified) {
    const name = r.category?.name ?? "Outros";
    const cur = perCategory.get(name) ?? { icon: r.category?.icon ?? "🧾", cents: 0 };
    cur.cents += r.tx.amountCents;
    perCategory.set(name, cur);
  }
  const categoriesRanked = [...perCategory.entries()].sort((a, b) => b[1].cents - a[1].cents);
  const maxCategory = categoriesRanked[0]?.[1].cents ?? 1;
  const batches = db.select().from(importBatches).orderBy(desc(importBatches.id)).limit(5).all();

  return (
    <>
      <PageTitle title="Dashboard" subtitle={`Situação em ${dateTime(now(db))}`} />

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl">📥</p>
          <p className="mt-2 font-semibold">Nenhuma despesa ainda</p>
          <p className="text-sm text-slate-500">Importe o arquivo de cartões do Bradesco para começar.</p>
          <Link href="/admin/importar" className="btn-primary mt-4">Importar arquivo</Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Kpi label="Total gasto" value={money(sum(rows))} hint={`${rows.length} lançamentos recebidos`} />
            <Kpi label="Classificadas" value={`${pct}%`} hint={`${classified.length} despesa${classified.length === 1 ? "" : "s"} · ${money(sum(classified))}`} tone="green" href="/admin/transacoes?status=classificada" />
            <Kpi label="Pendentes (no prazo)" value={String(pending.length)} hint={money(sum(pending))} tone="amber" href="/admin/transacoes?status=pendente" />
            <Kpi label="Ignoradas (prazo vencido)" value={String(ignored.length)} hint={`${money(sum(ignored))} sem justificativa`} tone="red" href="/admin/transacoes?status=ignorada" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card overflow-hidden xl:col-span-2">
              <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Por funcionário</h2>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-2">Funcionário</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-center">Classificadas</th>
                    <th className="px-3 py-2 text-center">Pendentes</th>
                    <th className="px-3 py-2 text-center">Ignoradas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeesRanked.map((e) => {
                    const count = (s: string) => e.rows.filter((r) => r.status === s).length;
                    const link = e.id ? `/admin/transacoes?funcionario=${e.id}` : "/admin/funcionarios";
                    return (
                      <tr key={e.name} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5"><Link href={link} className="font-medium text-slate-800 hover:text-brand-600">{e.name}</Link></td>
                        <td className="px-3 py-2.5 text-right font-medium">{money(sum(e.rows))}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-600">{count("classificada")}</td>
                        <td className="px-3 py-2.5 text-center text-amber-600">{count("pendente")}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-red-600">{count("ignorada") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-6">
              <div className="card p-5">
                <h2 className="mb-3 font-semibold">Gasto por categoria</h2>
                {categoriesRanked.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma despesa classificada ainda.</p>
                ) : (
                  <ul className="space-y-3">
                    {categoriesRanked.map(([name, c]) => (
                      <li key={name}>
                        <div className="flex justify-between text-sm"><span>{c.icon} {name}</span><span className="font-medium">{money(c.cents)}</span></div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(c.cents / maxCategory) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-5">
                <h2 className="mb-3 font-semibold">Últimas importações</h2>
                <ul className="space-y-2 text-sm">
                  {batches.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{b.checkOk ? "✅" : "⚠️"} {b.fileName}</span>
                      <span className="shrink-0 text-xs text-slate-500">{b.newTransactions} novas</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
