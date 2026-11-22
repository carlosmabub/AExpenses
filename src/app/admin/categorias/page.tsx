import { getDb } from "@/db";
import { listCategories } from "@/lib/expenses";
import { PageTitle } from "@/components/page-title";
import { saveCategory } from "../actions";

export default async function CategoriesPage() {
  const cats = await listCategories(await getDb(), false);
  return (
    <>
      <PageTitle title="Categorias" subtitle="Opções que o funcionário vê ao classificar. Os códigos MCC fazem a sugestão automática pelo ramo do estabelecimento." />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2 w-20">Ícone</th><th className="px-2 py-2">Nome</th><th className="px-2 py-2">MCCs para sugestão (ex.: 5411,5812-5814)</th><th className="px-2 py-2">Ativa</th><th className="px-2 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cats.map((c) => {
              const formId = `cat-${c.id}`;
              return (
                <tr key={c.id} className={c.active ? "" : "opacity-60"}>
                  <td className="px-4 py-2"><form id={formId} action={saveCategory}><input type="hidden" name="id" value={c.id} /></form><input form={formId} name="icon" defaultValue={c.icon} className="input w-14 text-center" /></td>
                  <td className="px-2 py-2"><input form={formId} name="name" defaultValue={c.name} className="input" /></td>
                  <td className="px-2 py-2"><input form={formId} name="mccs" defaultValue={c.mccs} className="input font-mono text-xs" /></td>
                  <td className="px-2 py-2"><select form={formId} name="active" defaultValue={c.active ? "1" : "0"} className="input w-20"><option value="1">Sim</option><option value="0">Não</option></select></td>
                  <td className="px-2 py-2"><button form={formId} className="btn-ghost px-3 py-1.5">Salvar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form action={saveCategory} className="card mt-6 grid grid-cols-2 gap-3 p-5 md:grid-cols-5">
        <h2 className="col-span-2 font-semibold md:col-span-5">Nova categoria</h2>
        <input name="icon" placeholder="Ícone (emoji)" className="input" />
        <input name="name" placeholder="Nome" required className="input" />
        <input name="mccs" placeholder="MCCs (opcional)" className="input md:col-span-2" />
        <button className="btn-primary">Adicionar</button>
      </form>
    </>
  );
}
