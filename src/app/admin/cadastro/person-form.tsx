"use client";

import { startTransition, useActionState, useState } from "react";
import type { PersonFormState } from "./actions";
import { savePersonAction } from "./actions";

export interface PersonFormProps {
  person?: { id: number; name: string; email: string; role: string; costCenter: string; cardHolderName: string; leaderId: number | null; active: boolean };
  leaders: { id: number; name: string }[];
  cards: { id: number; label: string; checked: boolean }[];
  candidates: { id: number; name: string; checked: boolean; leaderName: string | null }[];
  costCenters: string[];
}

/** Cadastro completo: dados, perfil, líder, cartões e (para aprovador) os liderados. */
export function PersonForm({ person, leaders, cards, candidates, costCenters }: PersonFormProps) {
  const [state, action, pending] = useActionState<PersonFormState, FormData>(savePersonAction, null);
  const [role, setRole] = useState(person?.role ?? "funcionario");
  const leads = role === "aprovador" || role === "admin";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="max-w-3xl"
    >
      {person && <input type="hidden" name="id" value={person.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label className="label" htmlFor="p-name">nome</label><input id="p-name" name="name" required defaultValue={person?.name} className="input" /></div>
        <div><label className="label" htmlFor="p-email">e-mail (login)</label><input id="p-email" name="email" type="email" required defaultValue={person?.email} className="input" /></div>
        <div>
          <label className="label" htmlFor="p-pass">{person ? "nova senha (deixe em branco para manter)" : "senha inicial"}</label>
          <input id="p-pass" name="password" type="password" autoComplete="new-password" required={!person} minLength={6} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="p-role">perfil</label>
          <select id="p-role" name="role" value={role} onChange={(e) => setRole(e.target.value)} className="input">
            <option value="funcionario">Funcionário</option>
            <option value="aprovador">Aprovador (lidera uma equipe)</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-cc">centro de custo</label>
          <input id="p-cc" name="costCenter" list="cost-centers" defaultValue={person?.costCenter} className="input" />
          <datalist id="cost-centers">{costCenters.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor="p-leader">líder (quem aprova os relatórios)</label>
          <select id="p-leader" name="leaderId" defaultValue={person?.leaderId ?? ""} className="input">
            <option value="">sem líder (aprova o administrador)</option>
            {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-holder">nome no cartão (como o banco envia)</label>
          <input id="p-holder" name="cardHolderName" defaultValue={person?.cardHolderName} className="input" />
          <p className="mt-1 text-sm text-muted">Cartões novos com esse nome são vinculados sozinhos na importação.</p>
        </div>
      </div>

      <fieldset className="mt-8 border-t border-rule pt-5">
        <legend className="head text-lg text-ink">cartões desta pessoa</legend>
        {cards.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhum cartão disponível. Importe o arquivo do banco para listar os cartões.</p>
        ) : (
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {cards.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 items-center gap-3 text-ink">
                  <input type="checkbox" name="cardIds" value={c.id} defaultChecked={c.checked} className="h-4 w-4 accent-[var(--color-ink)]" /> {c.label}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {leads && (
        <fieldset className="mt-8 border-t border-rule pt-5">
          <legend className="head text-lg text-ink">liderados</legend>
          <p className="mt-2 text-sm text-muted">Quem for marcado passa a ter esta pessoa como líder; ela aprova os relatórios deles e vê os gastos da equipe.</p>
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 items-center gap-3 text-ink">
                  <input type="checkbox" name="teamIds" value={c.id} defaultChecked={c.checked} className="h-4 w-4 accent-[var(--color-ink)]" />
                  <span>{c.name}{c.leaderName && !c.checked ? <span className="text-sm text-muted"> (hoje com {c.leaderName})</span> : null}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <p className="mt-6 min-h-[1lh] text-sm text-error" aria-live="polite">{state?.error}</p>
      <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>{pending ? "salvando…" : person ? "salvar alterações" : "criar usuário"}</button>
    </form>
  );
}
