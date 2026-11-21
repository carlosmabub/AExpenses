import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { importBatches } from "@/db/schema";
import { clockMode, deadlineHours, now } from "@/lib/clock";
import { date, dateTime, longDay, money } from "@/lib/format";
import { PageTitle } from "@/components/page-title";
import { moveClock, resetPilot, setClockMode, setDeadline } from "../actions";
import { ImportForm } from "./import-form";

export default function ImportPage() {
  const db = getDb();
  const simulated = clockMode(db) === "simulado";
  const batches = db.select().from(importBatches).orderBy(desc(importBatches.id)).all();

  return (
    <>
      <PageTitle title="Importar arquivo" subtitle="Arquivo de cartões do Bradesco (BVK3). Cada importação é conferida com os totais do próprio arquivo." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ImportForm />
          <div className="card mt-6 overflow-hidden">
            <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Histórico</h2>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-5 py-2">Arquivo</th><th className="px-3 py-2">Processamento</th><th className="px-3 py-2">Conferência</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Novas</th><th className="px-3 py-2">Importado em</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-500">Nenhuma importação ainda.</td></tr>}
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-5 py-2.5">{b.fileName}</td>
                    <td className="px-3 py-2.5">{date(b.processingDate)}</td>
                    <td className="px-3 py-2.5">{b.checkOk ? "✅ ok" : "⚠️ divergente"}</td>
                    <td className="px-3 py-2.5 text-right">{money(b.readTotalCents)}</td>
                    <td className="px-3 py-2.5 text-right">{b.newTransactions}</td>
                    <td className="px-3 py-2.5 text-slate-500">{dateTime(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold">Modo do piloto</h2>
            <p className="mt-1 text-sm text-slate-600">
              {simulated
                ? "Simulando o arquivo diário: cada compra chega no app no dia seguinte ao lançamento (D+1), às 08:00. Use o relógio para avançar os dias."
                : "Modo real: as compras chegam no momento da importação."}
            </p>
            {simulated && (
              <>
                <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">📅 {longDay(now(db))}</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[1, 2, 7, 30].map((d) => (
                    <form key={d} action={moveClock}>
                      <input type="hidden" name="days" value={d} />
                      <button className="btn-ghost w-full px-2">+{d} dia{d > 1 ? "s" : ""}</button>
                    </form>
                  ))}
                </div>
              </>
            )}
            <form action={setClockMode} className="mt-3">
              <input type="hidden" name="mode" value={simulated ? "real" : "simulado"} />
              <button className="text-sm font-medium text-brand-600 underline">{simulated ? "Mudar para modo real" : "Voltar ao modo simulado"}</button>
            </form>
          </div>

          <form action={setDeadline} className="card space-y-3 p-5">
            <h2 className="font-semibold">Prazo para classificar</h2>
            <p className="text-sm text-slate-600">Depois desse prazo a despesa vira “ignorada” e aparece para o financeiro. Vale para as próximas importações.</p>
            <div className="flex items-center gap-2">
              <input className="input w-24" type="number" name="hours" min={1} max={720} defaultValue={deadlineHours(db)} />
              <span className="text-sm text-slate-600">horas</span>
              <button className="btn-ghost ml-auto">Salvar</button>
            </div>
          </form>

          <form action={resetPilot} className="card space-y-2 p-5">
            <h2 className="font-semibold">Recomeçar demonstração</h2>
            <p className="text-sm text-slate-600">Apaga importações, cartões e despesas. Funcionários e categorias são mantidos.</p>
            <button className="btn-ghost text-red-600">Apagar dados do piloto</button>
          </form>
        </div>
      </div>
    </>
  );
}
