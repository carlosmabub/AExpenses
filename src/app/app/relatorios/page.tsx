import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { listEmployeeReports } from "@/lib/reports";
import { TopBar } from "@/components/mobile/top-bar";
import { ReportRow } from "@/components/mobile/rows";

export default async function ReportsPage() {
  const user = await requireUser();
  const reports = await listEmployeeReports(await getDb(), user.id);
  return (
    <>
      <TopBar title="Relatórios" back="/app/menu" />
      {reports.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">Nenhum relatório ainda. Crie um pelo botão +.</p>
      ) : (
        <ul className="surface-card -mt-3 overflow-hidden">{reports.map((r) => <ReportRow key={r.report.id} summary={r} />)}</ul>
      )}
    </>
  );
}
