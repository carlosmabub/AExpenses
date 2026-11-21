"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { classifyExpense, ExpenseError, getExpense } from "@/lib/expenses";
import { saveReceipt } from "@/lib/receipts";

export async function classify(_: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser();
  const db = getDb();
  const transactionId = Number(form.get("transactionId"));
  const expense = getExpense(db, transactionId);
  if (!expense || expense.card.employeeId !== user.id) return "Despesa não encontrada.";

  try {
    let receipt: { path: string; mime: string } | undefined;
    const file = form.get("receipt");
    if (file instanceof File && file.size > 0) receipt = await saveReceipt(file, transactionId);
    classifyExpense(db, {
      transactionId,
      employeeId: user.id,
      categoryId: Number(form.get("categoryId")),
      description: String(form.get("description") ?? ""),
      costCenter: String(form.get("costCenter") ?? ""),
      ...(receipt ? { receiptPath: receipt.path, receiptMime: receipt.mime } : {}),
    });
  } catch (error) {
    if (error instanceof ExpenseError || error instanceof Error) return error.message;
    throw error;
  }
  revalidatePath("/app", "layout");
  redirect("/app?salvo=1");
}
