import { getDb } from "@/db";
import { currentUser } from "@/lib/auth";
import { getExpense } from "@/lib/expenses";
import { readReceipt } from "@/lib/receipts";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Não autorizado", { status: 401 });
  const expense = await getExpense(await getDb(), Number((await params).id));
  const receipt = expense?.e.receiptPath;
  if (!expense || !receipt || (user.role !== "admin" && expense.owner?.id !== user.id)) {
    return new Response("Não encontrado", { status: 404 });
  }
  const body = await readReceipt(receipt);
  if (!body) return new Response("Comprovante não encontrado", { status: 404 });
  return new Response(Buffer.isBuffer(body) ? new Uint8Array(body) : body, {
    headers: { "Content-Type": expense.e.receiptMime ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" },
  });
}
