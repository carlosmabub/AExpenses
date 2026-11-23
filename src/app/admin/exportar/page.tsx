import { Download } from "lucide-react";
import { PageTitle } from "@/components/page-title";

export default function ExportPage() {
  return (
    <>
      <PageTitle title="exportar excel" subtitle="A planilha da prestação de contas, pronta para a carga no ERP." />
      <form action="/admin/exportar/arquivo" className="grid max-w-2xl grid-cols-2 items-end gap-4">
        <div><label className="label" htmlFor="e-de">compras de</label><input id="e-de" type="date" name="de" className="input" /></div>
        <div><label className="label" htmlFor="e-ate">até</label><input id="e-ate" type="date" name="ate" className="input" /></div>
        <div className="col-span-2">
          <label className="label" htmlFor="e-status">status</label>
          <select id="e-status" name="status" className="input" defaultValue="">
            <option value="">todos</option>
            <option value="aprovada">só aprovadas</option>
            <option value="em_aprovacao">só em aprovação</option>
            <option value="devolvida">só devolvidas</option>
            <option value="sem_relatorio">só sem relatório</option>
            <option value="ignorada">só ignoradas</option>
          </select>
        </div>
        <p className="col-span-2 text-sm text-ink-2">
          Sai tudo, com relatório, status e a aprovação de cada despesa (aprovada, devolvida e o comentário do aprovador), além de forma de pagamento, datas, estabelecimento, CNPJ, MCC, valor, tipo, descrição e comprovante.
        </p>
        <button type="submit" className="btn-primary col-span-2 w-fit"><Download size={16} aria-hidden="true" /> baixar planilha</button>
      </form>
    </>
  );
}
