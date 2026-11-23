"use client";

import { startTransition, useActionState } from "react";
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
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {props.reportId && <input type="hidden" name="reportId" value={props.reportId} />}
      <div>
        <label className="label" htmlFor="name">nome do relatório</label>
        <input className="input" id="name" name="name" required placeholder="Ex.: Viagem a Campinas, julho" defaultValue={props.defaults.name} />
      </div>
      <div>
        <label className="label" htmlFor="costCenter">centro de custo</label>
        <input className="input" id="costCenter" name="costCenter" defaultValue={props.defaults.costCenter} />
      </div>
      <fieldset>
        <legend className="label">adiantamentos</legend>
        {props.advances.length === 0 ? (
          <p className="text-sm text-muted">Nenhum adiantamento em aberto.</p>
        ) : (
          <ul className="border-t border-rule">
            {props.advances.map((a) => (
              <li key={a.id} className="border-b border-rule">
                <label className="flex min-h-12 items-center gap-3 text-sm text-ink">
                  <input type="checkbox" name="advanceIds" value={a.id} defaultChecked={props.defaults.advanceIds.includes(a.id)} className="h-4 w-4 accent-[var(--color-ink)]" />
                  {a.label}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <div>
        <label className="label" htmlFor="notes">observações</label>
        <textarea className="textarea" id="notes" name="notes" defaultValue={props.defaults.notes} />
      </div>
      <p className="min-h-[1lh] text-sm text-error" aria-live="polite">{state?.error}</p>
      <button type="submit" className="btn-primary w-full" disabled={pending} aria-busy={pending}>{pending ? "salvando…" : props.submitLabel}</button>
    </form>
  );
}

export function SubmitReportButton({ action, reportId, disabled }: { action: Props["action"]; reportId: number; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="reportId" value={reportId} />
      <button type="submit" className="btn-primary min-h-12 w-full text-base" disabled={pending || disabled} aria-busy={pending}>
        {pending ? "enviando…" : "enviar para aprovação"}
      </button>
      <p className="mt-2 min-h-[1lh] text-sm text-error" aria-live="polite">{state?.error}</p>
    </form>
  );
}
