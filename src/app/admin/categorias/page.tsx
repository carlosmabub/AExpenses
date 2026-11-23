import { getDb } from "@/db";
import { listCategories } from "@/lib/expenses";
import { PageTitle } from "@/components/page-title";
import { CATEGORY_ICONS, CategoryIcon } from "@/components/category-icon";
import { saveCategory } from "../actions";

function IconSelect({ id, form, value }: { id: string; form?: string; value: string }) {
  return (
    <select id={id} form={form} name="icon" defaultValue={value} className="input w-44">
      {Object.entries(CATEGORY_ICONS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
    </select>
  );
}

export default async function CategoriesPage() {
  const cats = await listCategories(await getDb(), false);
  return (
    <>
      <PageTitle title="tipos de despesa" subtitle="As opções que o funcionário vê ao preencher. Os códigos MCC sugerem o tipo pelo ramo do estabelecimento; a política define se o comprovante é obrigatório." />
      <div className="overflow-x-auto">
        <table className="data-table min-w-[960px]">
          <thead>
            <tr><th scope="col">ícone</th><th scope="col">nome</th><th scope="col">MCCs para sugestão (ex.: 5411,5812-5814)</th><th scope="col">exige comprovante</th><th scope="col">ativo</th><th scope="col"><span className="visually-hidden">ações</span></th></tr>
          </thead>
          <tbody>
            {cats.map((c) => {
              const formId = `cat-${c.id}`;
              return (
                <tr key={c.id} className={c.active ? "" : "text-muted"}>
                  <td>
                    <form id={formId} action={saveCategory}><input type="hidden" name="id" value={c.id} /></form>
                    <span className="flex items-center gap-3">
                      <CategoryIcon name={c.icon} className="text-muted" />
                      <label className="visually-hidden" htmlFor={`icon-${c.id}`}>Ícone de {c.name}</label>
                      <IconSelect id={`icon-${c.id}`} form={formId} value={c.icon} />
                    </span>
                  </td>
                  <td><input form={formId} name="name" aria-label="Nome" defaultValue={c.name} className="input" /></td>
                  <td><input form={formId} name="mccs" aria-label="MCCs" defaultValue={c.mccs} className="input tabular-nums" /></td>
                  <td><select form={formId} name="requiresReceipt" aria-label="Exige comprovante" defaultValue={c.requiresReceipt ? "1" : "0"} className="input w-24"><option value="1">sim</option><option value="0">não</option></select></td>
                  <td><select form={formId} name="active" aria-label="Ativo" defaultValue={c.active ? "1" : "0"} className="input w-24"><option value="1">sim</option><option value="0">não</option></select></td>
                  <td><button type="submit" form={formId} className="btn-ghost">salvar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form action={saveCategory} className="mt-12 border-t border-rule pt-8">
        <h2 className="head text-xl text-ink">novo tipo de despesa</h2>
        <div className="mt-4 grid grid-cols-2 items-end gap-4 md:grid-cols-5">
          <div><label className="label" htmlFor="c-icon">ícone</label><IconSelect id="c-icon" value="receipt" /></div>
          <div><label className="label" htmlFor="c-name">nome</label><input id="c-name" name="name" required className="input" /></div>
          <div className="md:col-span-2"><label className="label" htmlFor="c-mccs">MCCs (opcional)</label><input id="c-mccs" name="mccs" className="input" /></div>
          <button type="submit" className="btn-primary">adicionar</button>
        </div>
      </form>
    </>
  );
}
