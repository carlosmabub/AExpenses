import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { listCategories, openReports } from "@/lib/expenses";
import { ExpenseForm } from "@/components/expense-form";
import { createManualExpenseAction } from "../[id]/actions";

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ relatorio?: string }> }) {
  const { relatorio } = await searchParams;
  const user = await requireUser();
  const db = await getDb();
  const reports = await openReports(db, user.id);
  const reportId = reports.find((r) => r.id === Number(relatorio))?.id ?? null;
  return (
    <>
      <Link href="/app" className="link mt-4 inline-flex min-h-11 items-center gap-1 font-display text-sm lowercase text-muted">
        <ChevronLeft size={16} aria-hidden="true" /> voltar
      </Link>
      <h1 className="head text-3xl text-ink">nova despesa</h1>
      <p className="mt-2 text-sm text-muted">Para gastos fora do cartão corporativo. As compras do cartão chegam sozinhas pelo banco.</p>
      <div className="mt-6">
        <ExpenseForm
          action={createManualExpenseAction}
          mode="new"
          categories={(await listCategories(db)).map((c) => ({ id: c.id, name: c.name, requiresReceipt: c.requiresReceipt }))}
          reports={reports.map((r) => ({ id: r.id, name: r.name }))}
          defaults={{ categoryId: null, description: "", costCenter: user.costCenter, reportId, purchaseDate: (await now(db)).toISOString().slice(0, 10) }}
          hasReceipt={false}
          back={reportId ? `/app/relatorios/${reportId}` : undefined}
        />
      </div>
    </>
  );
}
