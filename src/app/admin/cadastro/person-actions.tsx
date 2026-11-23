"use client";

import { startTransition, useActionState, useState } from "react";
import { deleteAction, reactivateAction, terminateAction, type PersonFormState } from "./actions";

/** Desligar (com data e confirmação), reativar e excluir (só sem histórico). */
export function PersonActions({ id, active, canDelete, today }: { id: number; active: boolean; canDelete: boolean; today: string }) {
  const [term, termAction, terming] = useActionState<PersonFormState, FormData>(terminateAction, null);
  const [del, delAction, deleting] = useActionState<PersonFormState, FormData>(deleteAction, null);
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-10 border-t border-rule pt-6" aria-labelledby="situacao">
      <h2 id="situacao" className="head text-lg text-ink">situação</h2>
      {active ? (
        open ? (
          <form
            onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => termAction(data)); }}
            className="well mt-3 max-w-xl p-5"
          >
            <input type="hidden" name="id" value={id} />
            <p className="text-ink">O usuário perde o acesso, os cartões ficam sem dono e os liderados dele passam a ser aprovados pelo administrador. Despesas, relatórios e adiantamentos continuam no histórico.</p>
            <label className="label mt-4" htmlFor="t-date">data do desligamento</label>
            <input id="t-date" type="date" name="date" required defaultValue={today} className="input w-48" />
            <p className="mt-3 min-h-[1lh] text-sm text-error" aria-live="polite">{term?.error}</p>
            <div className="mt-2 flex gap-3">
              <button type="submit" className="btn-danger" disabled={terming}>confirmar desligamento</button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>cancelar</button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn-ghost mt-3" onClick={() => setOpen(true)}>desligar funcionário</button>
        )
      ) : (
        <form action={reactivateAction} className="mt-3">
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn-ghost">reativar usuário</button>
        </form>
      )}
      {canDelete && (
        <form onSubmit={(e) => { e.preventDefault(); if (!confirm("Excluir este usuário? Isso não pode ser desfeito.")) return; const data = new FormData(e.currentTarget); startTransition(() => delAction(data)); }} className="mt-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-muted">Sem nenhuma despesa, relatório ou adiantamento: pode ser excluído (cadastro feito por engano).</p>
          <button type="submit" className="btn-danger mt-2" disabled={deleting}>excluir usuário</button>
          <p className="mt-2 text-sm text-error" aria-live="polite">{del?.error}</p>
        </form>
      )}
    </section>
  );
}
