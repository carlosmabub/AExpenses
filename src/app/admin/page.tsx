import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { importBatches } from "@/db/schema";
import { now } from "@/lib/clock";
import { listAdminExpenses, type ExpenseRow } from "@/lib/expenses";
import { dateTime, money } from "@/lib/format";
import { CategoryIcon } from "@/components/category-icon";

function sum(rows: ExpenseRow[]) {
  return rows.reduce((s, r) => s + r.tx.amountCents, 0);
}

function Figure({ label, value, hint, href, accent }: { label: string; value: string; hint: string; href: string; accent?: boolean }) {
  return (
    <Link href={href} className="group block py-5 pr-6 transition-colors duration-100 hover:bg-paper-2/60 sm:border-l sm:border-rule sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
      <span className="label">{label}</span>
      <span className={`figure block text-5xl ${accent ? "text-accent" : "text-ink"}`}>{value}</span>
      <span className="mt-2 block text-sm text-muted">{hint}</span>
    </Link>
  );
}

export default async function Dashboard() {
  const db = await getDb();
  const rows = (await listAdminExpenses(db)).filter((r) => r.tx.kind !== "estorno");
  const by = (s: string) => rows.filter((r) => r.status === s);
  const classified = by("classificada");
  const pending = by("pendente");
  const ignored = by("ignorada");
  const pct = rows.length ? Math.round((classified.length / rows.length) * 100) : 0;

  const perEmployee = new Map<string, { id?: number; name: string; rows: ExpenseRow[] }>();
  for (const r of rows) {
    const key = r.employee ? String(r.employee.id) : `card-${r.card.id}`;
    const name = r.employee?.name ?? `${r.card.holderName} (cartão não vinculado)`;
    if (!perEmployee.has(key)) perEmployee.set(key, { id: r.employee?.id, name, rows: [] });
    perEmployee.get(key)!.rows.push(r);
  }
  const employeesRanked = [...perEmployee.values()].sort(
    (a, b) => b.rows.filter((r) => r.status === "ignorada").length - a.rows.filter((r) => r.status === "ignorada").length || sum(b.rows) - sum(a.rows),
  );

  const perCategory = new Map<string, { icon: string; cents: number }>();
  for (const r of classified) {
    const name = r.category?.name ?? "Outros";
    const cur = perCategory.get(name) ?? { icon: r.category?.icon ?? "receipt", cents: 0 };
    cur.cents += r.tx.amountCents;
    perCategory.set(name, cur);
  }
  const categoriesRanked = [...perCategory.entries()].sort((a, b) => b[1].cents - a[1].cents);
  const maxCategory = categoriesRanked[0]?.[1].cents ?? 1;
  const batches = await db.select().from(importBatches).orderBy(desc(importBatches.id)).limit(5).all();

  if (rows.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="head text-3xl text-ink">nenhuma despesa ainda</h1>
        <p className="mt-3 text-ink-2">Importe o arquivo de cartões do Bradesco para as compras chegarem aos funcionários.</p>
        <Link href="/admin/importar" className="btn-primary mt-6">importar arquivo</Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="head text-3xl text-ink">prestação de contas</h1>
        <p className="text-sm text-muted">situação em {dateTime(await now(db))}</p>
      </div>

      <div className="mt-6 grid border-y border-rule sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="total recebido do banco" value={money(sum(rows))} hint={`${rows.length} lançamentos`} href="/admin/transacoes" />
        <Figure label="classificadas" value={`${pct}%`} hint={`${classified.length} despesa${classified.length === 1 ? "" : "s"}, ${money(sum(classified))}`} href="/admin/transacoes?status=classificada" />
        <Figure label="no prazo, aguardando" value={String(pending.length)} hint={money(sum(pending))} href="/admin/transacoes?status=pendente" />
        <Figure label="ignoradas, prazo vencido" value={String(ignored.length)} hint={`${money(sum(ignored))} sem justificativa`} href="/admin/transacoes?status=ignorada" accent />
      </div>

      <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="por-funcionario" className="min-w-0">
          <h2 id="por-funcionario" className="head text-xl text-ink">por funcionário</h2>
          <p className="mt-1 text-sm text-muted">Quem tem mais despesas ignoradas aparece primeiro.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table min-w-[560px]">
              <thead>
                <tr>
                  <th scope="col">funcionário</th>
                  <th scope="col" className="text-right">total</th>
                  <th scope="col" className="text-right">classificadas</th>
                  <th scope="col" className="text-right">aguardando</th>
                  <th scope="col" className="text-right">ignoradas</th>
                </tr>
              </thead>
              <tbody>
                {employeesRanked.map((e) => {
                  const count = (s: string) => e.rows.filter((r) => r.status === s).length;
                  const link = e.id ? `/admin/transacoes?funcionario=${e.id}` : "/admin/funcionarios";
                  return (
                    <tr key={e.name}>
                      <td><Link href={link} className="link text-ink">{e.name}</Link></td>
                      <td className="text-right tabular-nums">{money(sum(e.rows))}</td>
                      <td className="text-right tabular-nums">{count("classificada")}</td>
                      <td className="text-right tabular-nums">{count("pendente")}</td>
                      <td className={`text-right tabular-nums ${count("ignorada") ? "font-medium text-error" : "text-muted"}`}>{count("ignorada")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="min-w-0 space-y-12">
          <section aria-labelledby="por-categoria">
            <h2 id="por-categoria" className="head text-xl text-ink">gasto por categoria</h2>
            {categoriesRanked.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Aparece quando as primeiras despesas forem classificadas.</p>
            ) : (
              <ul className="mt-4 space-y-4" aria-label="Gasto classificado por categoria">
                {categoriesRanked.map(([name, c]) => (
                  <li key={name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-ink"><CategoryIcon name={c.icon} size={16} className="text-muted" />{name}</span>
                      <span className="tabular-nums">{money(c.cents)}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-pill bg-accent-soft">
                      <div className="h-1.5 origin-left rounded-pill bg-accent" style={{ transform: `scaleX(${c.cents / maxCategory})` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="importacoes">
            <h2 id="importacoes" className="head text-xl text-ink">últimas importações</h2>
            <ul className="mt-3 border-t border-rule text-sm">
              {batches.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 border-b border-rule py-3">
                  <span className="truncate text-ink">{b.fileName}</span>
                  <span className="shrink-0 text-muted">{b.checkOk ? "conferido" : "divergente"}, {b.newTransactions} novas</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
