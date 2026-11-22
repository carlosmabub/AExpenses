import { asc } from "drizzle-orm";
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
      <PageTitle title="Funcionários e cartões" subtitle="Cada cartão do arquivo é ligado a um funcionário pelo nome do portador; ajuste aqui quando precisar." />

      {unlinked.length > 0 && (
        <div className="card mb-6 p-5 ring-amber-300">
          <h2 className="font-semibold text-amber-800">⚠️ Cartões não vinculados ({unlinked.length})</h2>
          <p className="text-sm text-slate-600">As compras destes cartões não aparecem para ninguém no app até serem vinculadas.</p>
          <div className="mt-3 space-y-2">
            {unlinked.map((c) => (
              <form key={c.id} action={linkCard} className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3">
                <input type="hidden" name="cardId" value={c.id} />
                <span className="font-medium">{c.holderName}</span>
                <span className="text-sm text-slate-500">final {c.last4} · CC banco {c.bankCostCenter || "—"}</span>
                <select name="employeeId" className="input ml-auto w-56" required defaultValue="">
                  <option value="" disabled>Vincular a…</option>
                  {funcionarios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn-primary">Vincular</button>
              </form>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th><th className="px-2 py-2">E-mail</th><th className="px-2 py-2">Centro de custo</th>
              <th className="px-2 py-2">Nome no cartão (banco)</th><th className="px-2 py-2">Perfil</th><th className="px-2 py-2">Cartões</th><th className="px-2 py-2">Ativo</th><th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {people.map((p) => {
              const formId = `emp-${p.id}`;
              const own = allCards.filter((c) => c.employeeId === p.id);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2"><form id={formId} action={saveEmployee}><input type="hidden" name="id" value={p.id} /></form><input form={formId} name="name" defaultValue={p.name} className="input" /></td>
                  <td className="px-2 py-2"><input form={formId} name="email" defaultValue={p.email} className="input" /></td>
                  <td className="px-2 py-2"><input form={formId} name="costCenter" defaultValue={p.costCenter} className="input w-28" /></td>
                  <td className="px-2 py-2"><input form={formId} name="cardHolderName" defaultValue={p.cardHolderName} className="input" /></td>
                  <td className="px-2 py-2">
                    <select form={formId} name="role" defaultValue={p.role} className="input w-36"><option value="funcionario">Funcionário</option><option value="admin">Admin</option></select>
                  </td>
                  <td className="px-2 py-2">
                    {own.length === 0 ? <span className="text-slate-400">—</span> : own.map((c) => (
                      <form key={c.id} action={linkCard} className="flex items-center gap-1 whitespace-nowrap">
                        <input type="hidden" name="cardId" value={c.id} /><input type="hidden" name="employeeId" value="" />
                        <span className="font-mono text-xs">•••• {c.last4}</span>
                        <button className="text-xs text-red-500" title="Desvincular">✕</button>
                      </form>
                    ))}
                  </td>
                  <td className="px-2 py-2">
                    <select form={formId} name="active" defaultValue={p.active ? "1" : "0"} className="input w-20"><option value="1">Sim</option><option value="0">Não</option></select>
                  </td>
                  <td className="px-2 py-2"><button form={formId} className="btn-ghost px-3 py-1.5">Salvar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={saveEmployee} className="card mt-6 grid grid-cols-2 gap-3 p-5 md:grid-cols-6">
        <h2 className="col-span-2 font-semibold md:col-span-6">Novo funcionário</h2>
        <input name="name" placeholder="Nome" required className="input" />
        <input name="email" type="email" placeholder="E-mail" required className="input" />
        <input name="costCenter" placeholder="Centro de custo" className="input" />
        <input name="cardHolderName" placeholder="Nome no cartão (banco)" className="input" />
        <input name="password" placeholder="Senha inicial" className="input" />
        <button className="btn-primary">Adicionar</button>
      </form>
    </>
  );
}
