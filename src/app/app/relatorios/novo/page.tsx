import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { openAdvances } from "@/lib/reports";
import { date, money } from "@/lib/format";
import { TopBar } from "@/components/mobile/top-bar";
import { ReportForm } from "../report-form";
import { createReportAction } from "../actions";

export default async function NewReportPage() {
  const user = await requireUser();
  const advances = await openAdvances(await getDb(), user.id);
  return (
    <>
      <TopBar title="Relatório" back="/app" />
      <section className="surface-card -mt-3 px-4 pb-4 pt-1">
        <ReportForm
          action={createReportAction}
          defaults={{ name: "", costCenter: user.costCenter, notes: "", advanceIds: [] }}
          advances={advances.map((a) => ({ id: a.id, label: `${money(a.amountCents)} em ${date(a.date)}, ${a.description}` }))}
          submitLabel="Salvar"
        />
      </section>
    </>
  );
}
