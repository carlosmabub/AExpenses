"use client";

import { startTransition, useActionState } from "react";
import { Building2, HandCoins, Pencil } from "lucide-react";
import type { ReportFormState } from "./actions";

interface Props {
  action: (state: ReportFormState, form: FormData) => Promise<ReportFormState>;
  reportId?: number;
  defaults: { name: string; costCenter: string; notes: string; advanceIds: number[] };
  advances: { id: number; label: string }[];
  submitLabel: string;
}

export function ReportForm(props: Props) {
  const [state, action, pending] = useActionState(props.action, null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {props.reportId && <input type="hidden" name="reportId" value={props.reportId} />}
      <div className="form-row">
        <Pencil size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-link" />
        <label htmlFor="name" className="visually-hidden">Nome do relatório</label>
        <input id="name" name="name" required placeholder="Nome do relatório" defaultValue={props.defaults.name} className="row-control text-left text-link" />
      </div>
      <div className="form-row">
        <Building2 size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-ink" />
        <label htmlFor="costCenter" className="shrink-0 text-ink">Centro de custos</label>
        <input id="costCenter" name="costCenter" placeholder="Selecione" defaultValue={props.defaults.costCenter} className="row-control" />
      </div>
      <fieldset className="border-b border-rule py-3">
        <legend className="flex min-h-10 items-center gap-3 text-ink">
          <HandCoins size={20} strokeWidth={1.75} aria-hidden="true" /> Adiantamentos
        </legend>
        {props.advances.length === 0 ? (
          <p className="pl-8 text-sm text-muted">Nenhum adiantamento em aberto.</p>
        ) : (
          props.advances.map((a) => (
            <label key={a.id} className="flex min-h-11 items-center gap-3 pl-8 text-sm text-ink">
              <input type="checkbox" name="advanceIds" value={a.id} defaultChecked={props.defaults.advanceIds.includes(a.id)} className="h-4 w-4 accent-[var(--color-ink)]" />
              {a.label}
            </label>
          ))
        )}
      </fieldset>
      <label htmlFor="notes" className="visually-hidden">Observações</label>
      <textarea id="notes" name="notes" placeholder="Observações" defaultValue={props.defaults.notes} className="well mt-4 block min-h-28 w-full resize-none border-0 p-4 text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-focus" />
      <p className="mt-3 min-h-[1lh] text-sm text-error" aria-live="polite">{state?.error}</p>
      <button type="submit" className="btn-primary min-h-12 w-full text-base normal-case" disabled={pending} aria-busy={pending}>{pending ? "Salvando…" : props.submitLabel}</button>
    </form>
  );
}

export function SubmitReportButton({ action, reportId, disabled }: { action: Props["action"]; reportId: number; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="reportId" value={reportId} />
      <button type="submit" className="btn-primary min-h-12 w-full text-base normal-case" disabled={pending || disabled} aria-busy={pending}>
        {pending ? "Enviando…" : "Enviar para aprovação"}
      </button>
      <p className="mt-2 min-h-[1lh] text-sm text-error" aria-live="polite">{state?.error}</p>
    </form>
  );
}
