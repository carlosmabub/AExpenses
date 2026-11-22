import { asc } from "drizzle-orm";
import { X } from "lucide-react";
import { getDb } from "@/db";
import { cards, employees } from "@/db/schema";
import { PageTitle } from "@/components/page-title";
import { linkCard, saveEmployee } from "../actions";

export default async function EmployeesPage() {
  const db = await getDb();
  const people = await db.select().from(employees).orderBy(asc(employees.role), asc(employees.name)).all();
  const allCards = (await db.select().from(cards).orderBy(asc(cards.holderName)).all()).filter((c) => !c.isBillingAccount);
  const unlinked = allCards.filter((c) => !c.employeeId);
  const funcionarios = people.filter((p) => p.role === "funcionario" && p.active);

  return (
    <>
      <PageTitle title="funcionários e cartões" subtitle="Cada cartão do arquivo é ligado a um funcionário pelo nome no cartão. Ajuste aqui quando precisar." />

      {unlinked.length > 0 && (
        <section className="well mb-10 p-5" aria-labelledby="nao-vinculados">
          <h2 id="nao-vinculados" className="head text-xl text-ink">
            {unlinked.length} cart{unlinked.length > 1 ? "ões" : "ão"} sem funcionário
          </h2>
          <p className="mt-1 text-sm text-ink-2">As compras destes cartões não aparecem para ninguém no app até serem vinculadas.</p>
          <ul className="mt-4 border-t border-rule">
            {unlinked.map((c) => (
              <li key={c.id} className="border-b border-rule py-3">
                <form action={linkCard} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="cardId" value={c.id} />
                  <span className="text-ink">{c.holderName}</span>
                  <span className="text-sm text-muted">final {c.last4}, centro de custo no banco {c.bankCostCenter || "não informado"}</span>
                  <label className="visually-hidden" htmlFor={`link-${c.id}`}>Funcionário para o cartão final {c.last4}</label>
                  <select id={`link-${c.id}`} name="employeeId" className="input ml-auto w-56" required defaultValue="">
                    <option value="" disabled>vincular a…</option>
                    {funcionarios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="submit" className="btn-primary">vincular</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto">
        <table className="data-table min-w-[1040px]">
          <thead>
            <tr>
              <th scope="col">nome</th><th scope="col">e-mail</th><th scope="col">centro de custo</th>
              <th scope="col">nome no cartão (banco)</th><th scope="col">perfil</th><th scope="col">cartões</th><th scope="col">ativo</th><th scope="col"><span className="visually-hidden">ações</span></th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const formId = `emp-${p.id}`;
              const own = allCards.filter((c) => c.employeeId === p.id);
              return (
                <tr key={p.id}>
                  <td><form id={formId} action={saveEmployee}><input type="hidden" name="id" value={p.id} /></form><input form={formId} name="name" aria-label="Nome" defaultValue={p.name} className="input" /></td>
                  <td><input form={formId} name="email" type="email" aria-label="E-mail" defaultValue={p.email} className="input" /></td>
                  <td><input form={formId} name="costCenter" aria-label="Centro de custo" defaultValue={p.costCenter} className="input w-28" /></td>
                  <td><input form={formId} name="cardHolderName" aria-label="Nome no cartão" defaultValue={p.cardHolderName} className="input" /></td>
                  <td>
                    <select form={formId} name="role" aria-label="Perfil" defaultValue={p.role} className="input w-36"><option value="funcionario">funcionário</option><option value="admin">admin</option></select>
                  </td>
                  <td>
                    {own.length === 0 ? <span className="text-muted">nenhum</span> : own.map((c) => (
                      <form key={c.id} action={linkCard} className="flex items-center gap-1 whitespace-nowrap">
                        <input type="hidden" name="cardId" value={c.id} /><input type="hidden" name="employeeId" value="" />
                        <span className="tabular-nums">final {c.last4}</span>
                        <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-muted hover:bg-paper-2 hover:text-error" aria-label={`Desvincular cartão final ${c.last4}`}>
                          <X size={14} aria-hidden="true" />
                        </button>
                      </form>
                    ))}
                  </td>
                  <td>
                    <select form={formId} name="active" aria-label="Ativo" defaultValue={p.active ? "1" : "0"} className="input w-24"><option value="1">sim</option><option value="0">não</option></select>
                  </td>
                  <td><button type="submit" form={formId} className="btn-ghost">salvar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={saveEmployee} className="mt-12 border-t border-rule pt-8">
        <h2 className="head text-xl text-ink">novo funcionário</h2>
        <div className="mt-4 grid grid-cols-2 items-end gap-4 md:grid-cols-6">
          <div><label className="label" htmlFor="n-name">nome</label><input id="n-name" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="n-email">e-mail</label><input id="n-email" name="email" type="email" required className="input" /></div>
          <div><label className="label" htmlFor="n-cc">centro de custo</label><input id="n-cc" name="costCenter" className="input" /></div>
          <div><label className="label" htmlFor="n-holder">nome no cartão</label><input id="n-holder" name="cardHolderName" className="input" /></div>
          <div><label className="label" htmlFor="n-pass">senha inicial</label><input id="n-pass" name="password" type="password" autoComplete="new-password" className="input" /></div>
          <button type="submit" className="btn-primary">adicionar</button>
        </div>
      </form>
    </>
  );
}
