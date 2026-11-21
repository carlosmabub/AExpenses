import { PageTitle } from "@/components/page-title";

export default function ExportPage() {
  return (
    <>
      <PageTitle title="Exportar Excel" subtitle="Planilha da prestação de contas para carga no ERP." />
      <form action="/admin/exportar/arquivo" className="card grid max-w-2xl grid-cols-2 gap-4 p-5">
        <div><label className="label">Compras de</label><input type="date" name="de" className="input" /></div>
        <div><label className="label">Até</label><input type="date" name="ate" className="input" /></div>
        <div className="col-span-2">
          <label className="label">Status</label>
          <select name="status" className="input" defaultValue="">
            <option value="">Todos</option>
            <option value="classificada">Só classificadas</option>
            <option value="ignorada">Só ignoradas</option>
            <option value="pendente">Só pendentes</option>
          </select>
        </div>
        <p className="col-span-2 text-sm text-slate-500">
          Colunas: funcionário, centro de custo, cartão, datas, estabelecimento, CNPJ, cidade, MCC, parcela, valor, categoria, descrição, comprovante, status e referência Visa.
        </p>
        <button className="btn-primary col-span-2 md:col-span-1">📤 Baixar planilha</button>
      </form>
    </>
  );
}
