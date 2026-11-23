"use client";

import { startTransition, useActionState, useState } from "react";
import { Camera } from "lucide-react";
import type { FormState } from "@/app/app/despesas/[id]/actions";

interface Option {
  id: number;
  name: string;
}

interface Props {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  mode: "edit" | "new";
  expenseId?: number;
  categories: (Option & { requiresReceipt: boolean })[];
  reports: Option[];
  defaults: { categoryId: number | null; description: string; costCenter: string; reportId: number | null; purchaseDate?: string };
  hasReceipt: boolean;
  /** Despesa devolvida: fica no relatório dela */
  lockReport?: boolean;
  back?: string;
}

export function ExpenseForm(props: Props) {
  const [state, action, pending] = useActionState(props.action, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>(props.defaults.categoryId ? String(props.defaults.categoryId) : "");
  const needsReceipt = props.categories.find((c) => String(c.id) === categoryId)?.requiresReceipt ?? true;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        // Sem o reset automático do React: se o salvar falhar, o que foi digitado fica
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {props.expenseId && <input type="hidden" name="expenseId" value={props.expenseId} />}
      {props.back && <input type="hidden" name="back" value={props.back} />}

      {props.mode === "new" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="amount">valor (R$)</label>
              <input className="input tabular-nums" id="amount" name="amount" inputMode="decimal" placeholder="0,00" required autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="purchaseDate">data</label>
              <input className="input" id="purchaseDate" name="purchaseDate" type="date" required defaultValue={props.defaults.purchaseDate} max={props.defaults.purchaseDate} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="merchant">onde foi</label>
            <input className="input" id="merchant" name="merchant" required placeholder="Ex.: Táxi do aeroporto" />
          </div>
          <fieldset>
            <legend className="label">forma de pagamento</legend>
            <div className="flex flex-wrap gap-2">
              {[
                ["dinheiro", "dinheiro (reembolso)"],
                ["adiantamento", "adiantamento"],
              ].map(([value, label], i) => (
                <label key={value} className="relative">
                  <input type="radio" name="paymentMethod" value={value} defaultChecked={i === 0} className="peer absolute h-px w-px opacity-0" />
                  <span className="pill min-h-10 cursor-pointer px-4 text-sm hover:bg-paper-2 peer-checked:bg-ink peer-checked:text-accent-ink peer-checked:shadow-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <div>
        <label className="label" htmlFor="categoryId">tipo da despesa</label>
        <select className="input" id="categoryId" name="categoryId" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="" disabled>selecione</option>
          {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="description">do que se trata?</label>
        <textarea className="textarea" id="description" name="description" required placeholder="Ex.: almoço com o cliente X durante a visita técnica" defaultValue={props.defaults.description} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="costCenter">centro de custo</label>
          <input className="input" id="costCenter" name="costCenter" defaultValue={props.defaults.costCenter} />
        </div>
        {!props.lockReport && (
          <div>
            <label className="label" htmlFor="reportId">relatório</label>
            <select className="input" id="reportId" name="reportId" defaultValue={props.defaults.reportId ?? ""}>
              <option value="">sem relatório</option>
              {props.reports.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <span className="label">
          comprovante {needsReceipt && <span className="text-ink-2">(obrigatório)</span>}
        </span>
        <label
          htmlFor="receipt"
          className={`well flex cursor-pointer flex-col items-center gap-2 p-5 text-center text-sm text-ink-2 transition-colors duration-100 hover:bg-paper-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${state?.policy ? "outline outline-2 outline-error" : ""}`}
        >
          {preview ? <img src={preview} alt="Prévia do comprovante" className="max-h-48 rounded-card" /> : <Camera size={28} strokeWidth={1.5} aria-hidden="true" className="text-muted" />}
          <span className="font-display lowercase">{fileName ?? (props.hasReceipt ? "comprovante anexado, toque para trocar" : "tirar foto ou escolher arquivo")}</span>
          <input
            id="receipt"
            type="file"
            name="receipt"
            accept="image/*,application/pdf"
            capture="environment"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFileName(f ? f.name : null);
              setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
      </div>

      {state?.policy ? (
        <div role="alert" className="well p-4 text-sm">
          <p className="font-medium text-ink">Política de despesa</p>
          <p className="mt-1 text-ink-2">{state.error.replace("Política de despesa: é", "É")}</p>
          <label htmlFor="receipt" className="btn-primary mt-3 cursor-pointer">inserir foto</label>
        </div>
      ) : (
        <p className="min-h-[1lh] text-sm text-error" aria-live="polite">{state?.error}</p>
      )}

      <button type="submit" className="btn-primary min-h-12 w-full text-base" disabled={pending} aria-busy={pending}>
        {pending ? "salvando…" : "salvar"}
      </button>
    </form>
  );
}
