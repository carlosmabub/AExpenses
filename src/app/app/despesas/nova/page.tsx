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
    <ExpenseForm
      action={createManualExpenseAction}
      mode="new"
      back={reportId ? `/app/relatorios/${reportId}` : "/app"}
      categories={(await listCategories(db)).map((c) => ({ id: c.id, name: c.name, requiresReceipt: c.requiresReceipt }))}
      reports={reports.map((r) => ({ id: r.id, name: r.name }))}
      defaults={{ categoryId: null, description: "", costCenter: user.costCenter, reportId, purchaseDate: (await now(db)).toISOString().slice(0, 10) }}
      hasReceipt={false}
    />
  );
}
