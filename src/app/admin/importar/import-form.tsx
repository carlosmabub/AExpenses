"use client";

import { useActionState } from "react";
import { importFile, type ImportState } from "../actions";
import { money } from "@/lib/format";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importFile, null);
  const r = state?.result;

  return (
    <div className="space-y-4">
      <form action={action} className="card space-y-4 p-5">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-brand-500">
          <span className="text-4xl">📄</span>
          <span className="font-semibold">Arquivo de cartões Bradesco (layout BVK3)</span>
          <span className="text-xs text-slate-500">.txt enviado pelo banco</span>
          <input type="file" name="file" accept=".txt,text/plain" required className="text-sm" />
        </label>
        <button className="btn-primary" disabled={pending}>{pending ? "Importando…" : "Importar"}</button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>

      {r && (
        <div className={`card p-5 ${r.imported ? "" : "ring-red-300"}`}>
          <h3 className="font-semibold">
            {r.imported ? "✅ Arquivo importado" : "⚠️ Arquivo não importado"} · {state?.fileName}
          </h3>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div><dt className="text-slate-500">Conferência com o trailer</dt><dd className={`font-semibold ${r.checkOk ? "text-emerald-600" : "text-red-600"}`}>{r.checkOk ? "Bate 100%" : "Divergente"}</dd></div>
            <div><dt className="text-slate-500">Total do arquivo</dt><dd className="font-semibold">{money(r.totalCents)}</dd></div>
            <div><dt className="text-slate-500">Despesas novas</dt><dd className="font-semibold">{r.newTransactions}</dd></div>
            <div><dt className="text-slate-500">Já importadas antes</dt><dd className="font-semibold">{r.duplicateTransactions}</dd></div>
            <div><dt className="text-slate-500">Linhas sem gasto</dt><dd className="font-semibold">{r.ignoredEntries}</dd><dd className="text-xs text-slate-400">saldo anterior, pagamento, ajustes</dd></div>
            <div><dt className="text-slate-500">Cartões novos</dt><dd className="font-semibold">{r.newCards}</dd></div>
          </dl>
          {r.unlinkedCards.length > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Cartões sem funcionário vinculado: <strong>{r.unlinkedCards.join(", ")}</strong>. Vincule em “Funcionários e cartões” para que as compras apareçam no app.
            </p>
          )}
          {r.problems.length > 0 && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Problemas encontrados</p>
              <ul className="mt-1 list-disc pl-5">{r.problems.map((p) => <li key={p}>{p}</li>)}</ul>
              {!r.imported && <p className="mt-2 text-xs">Confira o arquivo com o banco. Para importar mesmo assim, reenvie marcando “importar mesmo com divergência”.</p>}
            </div>
          )}
        </div>
      )}
      {r && !r.imported && (
        <form action={action} className="card flex items-center gap-3 p-4 text-sm">
          <input type="file" name="file" accept=".txt,text/plain" required />
          <input type="hidden" name="force" value="1" />
          <button className="btn-ghost">Importar mesmo com divergência</button>
        </form>
      )}
    </div>
  );
}
