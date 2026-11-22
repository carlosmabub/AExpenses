import { getDb } from "@/db";
import { currentUser } from "@/lib/auth";
import { listAdminExpenses } from "@/lib/expenses";
import { expensesWorkbook } from "@/lib/export";
import type { ExpenseStatus } from "@/lib/status";

export async function GET(request: Request) {
  const user = await currentUser();
  if (user?.role !== "admin") return new Response("Não autorizado", { status: 401 });
  const sp = new URL(request.url).searchParams;
  const rows = await listAdminExpenses(await getDb(), {
    employeeId: Number(sp.get("funcionario")) || undefined,
    status: (sp.get("status") || undefined) as ExpenseStatus | undefined,
    categoryId: Number(sp.get("categoria")) || undefined,
    from: sp.get("de") || undefined,
    to: sp.get("ate") || undefined,
  });
  const file = expensesWorkbook(rows);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="prestacao-de-contas.xlsx"`,
    },
  });
}
