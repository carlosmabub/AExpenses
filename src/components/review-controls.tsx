"use client";

import { useActionState, useState } from "react";
import { reviewExpenseAction } from "@/app/admin/actions";

/** Aprovar ou devolver uma despesa; devolver pede o que corrigir. */
export function ReviewControls({ expenseId, label }: { expenseId: number; label: string }) {
  const [state, action, pending] = useActionState(reviewExpenseAction, null);
  const [returning, setReturning] = useState(false);
  return (
    <form action={action} className="flex flex-wrap items-start justify-end gap-2">
      <input type="hidden" name="expenseId" value={expenseId} />
      {returning ? (
        <>
          <input type="hidden" name="decision" value="devolvida" />
          <label className="visually-hidden" htmlFor={`comment-${expenseId}`}>O que corrigir em {label}</label>
          <input id={`comment-${expenseId}`} name="comment" required autoFocus placeholder="O que corrigir?" className="input min-w-0 flex-1 basis-56" />
          <button type="submit" className="btn-danger" disabled={pending}>devolver</button>
          <button type="button" className="btn-ghost" onClick={() => setReturning(false)}>cancelar</button>
        </>
      ) : (
        <>
          <button type="submit" name="decision" value="aprovada" className="btn-primary w-[6.5rem]" disabled={pending} aria-label={`Aprovar ${label}`}>aprovar</button>
          <button type="button" className="btn-ghost w-[6.5rem]" onClick={() => setReturning(true)} aria-label={`Devolver ${label}`}>devolver</button>
        </>
      )}
      {state?.error && <p className="w-full text-right text-sm text-error" aria-live="polite">{state.error}</p>}
    </form>
  );
}
