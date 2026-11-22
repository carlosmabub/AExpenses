"use client";

import { useActionState } from "react";
import { FileText } from "lucide-react";
import { importFile, type ImportState } from "../actions";
import { money } from "@/lib/format";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importFile, null);
  const r = state?.result;

  return (
    <div className="space-y-8">
      <form action={action} className="well p-6">
        <label htmlFor="bvk3" className="flex items-center gap-3">
          <FileText size={24} strokeWidth={1.5} aria-hidden="true" className="text-muted" />
          <span>
            <span className="block font-medium text-ink">Arquivo de cartões Bradesco (layout BVK3)</span>
            <span className="block text-sm text-muted">O .txt enviado pelo banco.</span>
          </span>
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <input id="bvk3" type="file" name="file" accept=".txt,text/plain" required className="min-w-0 flex-1 text-sm text-ink-2 file:mr-3 file:rounded-pill file:border-0 file:bg-paper file:px-4 file:py-2 file:font-display file:text-sm file:lowercase file:text-ink" />
          <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>{pending ? "importando…" : "importar"}</button>
        </div>
        <p className="mt-2 min-h-[1lh] text-sm text-error" aria-live="polite">{state?.error}</p>
      </form>

      {r && (
        <section aria-labelledby="resultado" aria-live="polite">
          <h2 id="resultado" className="head text-xl text-ink">
            {r.imported ? "arquivo importado" : "arquivo não importado"}: {state?.fileName}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-rule py-5 md:grid-cols-3">
            <div><dt className="label">conferência com o trailer</dt><dd className={r.checkOk ? "text-success" : "font-medium text-error"}>{r.checkOk ? "bate 100%" : "divergente"}</dd></div>
            <div><dt className="label">total do arquivo</dt><dd className="tabular-nums">{money(r.totalCents)}</dd></div>
            <div><dt className="label">despesas novas</dt><dd className="tabular-nums">{r.newTransactions}</dd></div>
            <div><dt className="label">já importadas antes</dt><dd className="tabular-nums">{r.duplicateTransactions}</dd></div>
            <div><dt className="label">linhas sem gasto</dt><dd className="tabular-nums">{r.ignoredEntries}</dd><dd className="text-sm text-muted">saldo anterior, pagamento, ajustes</dd></div>
            <div><dt className="label">cartões novos</dt><dd className="tabular-nums">{r.newCards}</dd></div>
          </dl>
          {r.unlinkedCards.length > 0 && (
            <p className="mt-4 text-sm text-ink-2">
              Cartões sem funcionário vinculado: <strong className="font-medium text-ink">{r.unlinkedCards.join(", ")}</strong>. Vincule em funcionários para as compras aparecerem no app.
            </p>
          )}
          {r.problems.length > 0 && (
            <div className="mt-4 text-sm">
              <p className="font-medium text-error">Problemas encontrados</p>
              <ul className="mt-1 list-disc pl-5 text-ink-2">{r.problems.map((p) => <li key={p}>{p}</li>)}</ul>
              {!r.imported && <p className="mt-2 text-muted">Confira o arquivo com o banco. Para importar mesmo assim, envie de novo abaixo.</p>}
            </div>
          )}
          {!r.imported && (
            <form action={action} className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <input type="file" name="file" accept=".txt,text/plain" required aria-label="Arquivo BVK3" className="min-w-0 text-ink-2" />
              <input type="hidden" name="force" value="1" />
              <button type="submit" className="btn-danger" disabled={pending}>importar mesmo com divergência</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
