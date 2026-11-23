import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { openAdvances } from "@/lib/reports";
import { date, money } from "@/lib/format";
import { ReportForm } from "../report-form";
import { createReportAction } from "../actions";

export default async function NewReportPage() {
  const user = await requireUser();
  const advances = await openAdvances(await getDb(), user.id);
  return (
    <>
      <Link href="/app/relatorios" className="link mt-4 inline-flex min-h-11 items-center gap-1 font-display text-sm lowercase text-muted">
        <ChevronLeft size={16} aria-hidden="true" /> relatórios
      </Link>
      <h1 className="head text-3xl text-ink">novo relatório</h1>
      <div className="mt-6">
        <ReportForm
          action={createReportAction}
          defaults={{ name: "", costCenter: user.costCenter, notes: "", advanceIds: [] }}
          advances={advances.map((a) => ({ id: a.id, label: `${money(a.amountCents)} em ${date(a.date)}, ${a.description}` }))}
          submitLabel="criar relatório"
        />
      </div>
    </>
  );
}
