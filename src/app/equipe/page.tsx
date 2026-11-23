import Link from "next/link";
import { Download, TriangleAlert } from "lucide-react";
import { getDb } from "@/db";
import { requireApprover } from "@/lib/auth";
import { now } from "@/lib/clock";
import { money } from "@/lib/format";
import { teamAlerts, teamMonths, teamOf, teamSpending, type SpendingLine } from "@/lib/people";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;

function Bars({ lines, total, empty }: { lines: SpendingLine[]; total: number; empty: string }) {
  if (!lines.length) return <p className="mt-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="mt-3 border-t border-rule">
      {lines.map((l) => (
        <li key={l.key} className="border-b border-rule py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink">{l.label}</span>
            <span className="tabular-nums text-ink">{money(l.totalCents)}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-pill bg-paper-3" aria-hidden="true">
            <div className="h-full rounded-pill bg-ink" style={{ width: `${Math.max(2, Math.round((l.totalCents / (total || 1)) * 100))}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted">{l.count} despesa{l.count > 1 ? "s" : ""}</p>
        </li>
      ))}
    </ul>
  );
}

export default async function TeamDashboard({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const user = await requireApprover();
  const db = await getDb();
  const at = await now(db);
  const [team, months, alerts] = await Promise.all([teamOf(db, user.id), teamMonths(db, user.id), teamAlerts(db, user.id, at)]);
  const current = new Date(at.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 7);
  const options = [...new Set([current, ...months.filter((m) => m <= current)])].sort().reverse();
  const asked = (await searchParams).mes;
  const month = asked && /^\d{4}-\d{2}$/.test(asked) ? asked : current;
  const spending = await teamSpending(db, user.id, month);

  if (!team.length) {
    return (
      <>
        <h1 className="head text-3xl text-ink">minha equipe</h1>
        <p className="mt-3 max-w-xl text-ink-2">Você ainda não tem liderados. O administrador define a sua equipe no cadastro.</p>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="head text-3xl text-ink">gastos da equipe</h1>
          <p className="mt-2 text-sm text-muted">{(() => { const n = team.filter((p) => p.active).length; return `${n} ${n === 1 ? "pessoa" : "pessoas"}`; })()}, {monthLabel(month)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form className="flex items-center gap-2">
            <label className="visually-hidden" htmlFor="mes">Mês</label>
            <select id="mes" name="mes" defaultValue={month} className="input w-52">
              {options.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <button type="submit" className="btn-ghost">ver</button>
          </form>
          {/* Espaço reservado: exportação da equipe para estudo em Excel (ainda não disponível) */}
          <button type="button" className="btn-ghost" disabled aria-describedby="excel-nota"><Download size={16} aria-hidden="true" /> exportar para excel</button>
          <span id="excel-nota" className="text-sm text-muted">em breve</span>
        </div>
      </div>

      {alerts.length > 0 && (
        <section className="well mt-6 p-5" aria-labelledby="vencendo">
          <h2 id="vencendo" className="head flex items-center gap-2 text-xl text-ink"><TriangleAlert size={20} aria-hidden="true" className="text-accent" /> vencendo neste mês</h2>
          <p className="mt-1 text-sm text-ink-2">Despesas da equipe que saem do prazo no fim do mês e ainda não foram enviadas em relatório.</p>
          <ul className="mt-3 border-t border-rule">
            {alerts.map((a) => (
              <li key={a.person.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule py-3">
                <span className="text-ink">{a.person.name}</span>
                <span className="text-ink-2">{a.count} despesa{a.count > 1 ? "s" : ""}, <span className="tabular-nums">{money(a.totalCents)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="mt-8 grid border-y border-rule sm:grid-cols-3">
        <div className="py-4 pr-6"><dt className="label">total do mês</dt><dd className="figure text-4xl">{money(spending.totalCents)}</dd></div>
        <div className="py-4 pr-6 sm:border-l sm:border-rule sm:pl-6"><dt className="label">despesas</dt><dd className="figure text-4xl">{spending.count}</dd></div>
        <div className="py-4 sm:border-l sm:border-rule sm:pl-6">
          <dt className="label">aprovadas</dt>
          <dd className="figure text-4xl">{money(spending.byStatus.find((s) => s.key === "aprovada")?.totalCents ?? 0)}</dd>
        </div>
      </dl>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="por-pessoa"><h2 id="por-pessoa" className="head text-xl text-ink">por pessoa</h2><Bars lines={spending.byPerson} total={spending.totalCents} empty="Sem gastos neste mês." /></section>
        <section aria-labelledby="por-tipo"><h2 id="por-tipo" className="head text-xl text-ink">por tipo de despesa</h2><Bars lines={spending.byCategory} total={spending.totalCents} empty="Sem gastos neste mês." /></section>
      </div>
      <section className="mt-10" aria-labelledby="por-status"><h2 id="por-status" className="head text-xl text-ink">situação das despesas</h2><Bars lines={spending.byStatus} total={spending.totalCents} empty="Sem gastos neste mês." /></section>
      <p className="mt-10 text-sm text-muted">Para aprovar relatórios, abra <Link href="/equipe/aprovacoes" className="link text-link">aprovações</Link>.</p>
    </>
  );
}
