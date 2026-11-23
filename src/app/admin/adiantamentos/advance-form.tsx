"use client";

import { useActionState } from "react";
import { createAdvanceAction } from "../actions";

export function AdvanceForm({ people, today }: { people: { id: number; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState(createAdvanceAction, null);
  return (
    <form action={action} className="grid grid-cols-2 items-end gap-4 md:grid-cols-5">
      <div className="md:col-span-2">
        <label className="label" htmlFor="a-emp">funcionário</label>
        <select id="a-emp" name="employeeId" required defaultValue="" className="input">
          <option value="" disabled>selecione</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div><label className="label" htmlFor="a-amount">valor (R$)</label><input id="a-amount" name="amount" inputMode="decimal" required placeholder="0,00" className="input tabular-nums" /></div>
      <div><label className="label" htmlFor="a-date">data</label><input id="a-date" name="date" type="date" required defaultValue={today} className="input" /></div>
      <div className="col-span-2 md:col-span-4"><label className="label" htmlFor="a-desc">para que é</label><input id="a-desc" name="description" required placeholder="Ex.: visita técnica em Campinas" className="input" /></div>
      <button type="submit" className="btn-primary" disabled={pending}>registrar</button>
      <p className="col-span-2 min-h-[1lh] text-sm text-error md:col-span-5" aria-live="polite">{state?.error}</p>
    </form>
  );
}
