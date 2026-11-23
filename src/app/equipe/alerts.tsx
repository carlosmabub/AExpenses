import { TriangleAlert } from "lucide-react";
import { money } from "@/lib/format";
import type { TeamAlert } from "@/lib/people";

/** Aviso dos 3 últimos dias do mês: despesas da equipe que estão para vencer. */
export function TeamAlerts({ alerts }: { alerts: TeamAlert[] }) {
  if (!alerts.length) return null;
  return (
    <section className="well mb-8 p-5" aria-labelledby="vencendo">
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
  );
}
