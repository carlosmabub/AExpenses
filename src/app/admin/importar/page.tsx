import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { importBatches } from "@/db/schema";
import { clockMode, deadlineHours, now } from "@/lib/clock";
import { date, dateTime, longDay, money } from "@/lib/format";
import { PageTitle } from "@/components/page-title";
import { moveClock, resetPilot, setClockMode, setDeadline } from "../actions";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const db = await getDb();
  const simulated = (await clockMode(db)) === "simulado";
  const batches = await db.select().from(importBatches).orderBy(desc(importBatches.id)).all();

  return (
    <>
      <PageTitle title="importar arquivo" subtitle="Cada importação é conferida com os totais do próprio arquivo do banco." />
      <div className="grid gap-12 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-12">
          <ImportForm />
          <section aria-labelledby="historico">
            <h2 id="historico" className="head text-xl text-ink">histórico</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr><th scope="col">arquivo</th><th scope="col">processamento</th><th scope="col">conferência</th><th scope="col" className="text-right">total</th><th scope="col" className="text-right">novas</th><th scope="col">importado em</th></tr>
                </thead>
                <tbody>
                  {batches.length === 0 && <tr><td colSpan={6} className="py-6 text-muted">Nenhuma importação ainda.</td></tr>}
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>{b.fileName}</td>
                      <td className="tabular-nums">{date(b.processingDate)}</td>
                      <td className={b.checkOk ? "" : "text-error"}>{b.checkOk ? "conferido" : "divergente"}</td>
                      <td className="text-right tabular-nums">{money(b.readTotalCents)}</td>
                      <td className="text-right tabular-nums">{b.newTransactions}</td>
                      <td className="tabular-nums text-muted">{dateTime(b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-10">
          <section aria-labelledby="modo">
            <h2 id="modo" className="head text-xl text-ink">modo do piloto</h2>
            <p className="mt-2 text-sm text-ink-2">
              {simulated
                ? "Simulando o arquivo diário: cada compra chega ao app no dia seguinte ao lançamento, às 08:00. Avance os dias pelo relógio."
                : "Modo real: as compras chegam no momento da importação."}
            </p>
            {simulated && (
              <>
                <p className="mt-4 text-ink">{longDay(await now(db))}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[1, 2, 7, 30].map((d) => (
                    <form key={d} action={moveClock}>
                      <input type="hidden" name="days" value={d} />
                      <button type="submit" className="btn-ghost px-4">+{d} dia{d > 1 ? "s" : ""}</button>
                    </form>
                  ))}
                </div>
              </>
            )}
            <form action={setClockMode} className="mt-4">
              <input type="hidden" name="mode" value={simulated ? "real" : "simulado"} />
              <button type="submit" className="link font-display text-sm lowercase text-accent">{simulated ? "mudar para modo real" : "voltar ao modo simulado"}</button>
            </form>
          </section>

          <form action={setDeadline} className="border-t border-rule pt-8">
            <h2 className="head text-xl text-ink">prazo para classificar</h2>
            <p className="mt-2 text-sm text-ink-2">Depois do prazo a despesa vira ignorada e aparece para o financeiro. Vale para as próximas importações.</p>
            <div className="mt-4 flex items-end gap-3">
              <div className="w-28">
                <label className="label" htmlFor="hours">horas</label>
                <input className="input tabular-nums" id="hours" type="number" name="hours" min={1} max={720} defaultValue={await deadlineHours(db)} />
              </div>
              <button type="submit" className="btn-ghost">salvar</button>
            </div>
          </form>

          <form action={resetPilot} className="border-t border-rule pt-8">
            <h2 className="head text-xl text-ink">recomeçar a demonstração</h2>
            <p className="mt-2 text-sm text-ink-2">Apaga importações, cartões e despesas. Funcionários e categorias ficam.</p>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" name="confirm" required className="h-4 w-4 accent-[var(--color-error)]" />
              Entendo que os dados do piloto serão apagados.
            </label>
            <button type="submit" className="btn-danger mt-4">apagar dados do piloto</button>
          </form>
        </aside>
      </div>
    </>
  );
}
