import { getDb } from "@/db";
import { currentUser } from "@/lib/auth";
import { getExpense } from "@/lib/expenses";
import { readReceipt } from "@/lib/receipts";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Não autorizado", { status: 401 });
  const expense = getExpense(getDb(), Number((await params).id));
  const receipt = expense?.classification?.receiptPath;
  if (!expense || !receipt || (user.role !== "admin" && expense.card.employeeId !== user.id)) {
    return new Response("Não encontrado", { status: 404 });
  }
  const body = await readReceipt(receipt);
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": expense.classification?.receiptMime ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" },
  });
}
