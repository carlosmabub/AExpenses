"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { createManualExpense, ExpenseError, getExpense, saveExpense } from "@/lib/expenses";
import { parseMoney } from "@/lib/format";
import { saveReceipt } from "@/lib/receipts";

export type FormState = { error: string; policy?: boolean } | null;

async function receiptFrom(form: FormData, key: number | string) {
  const file = form.get("receipt");
  if (file instanceof File && file.size > 0) return saveReceipt(file, key);
  return undefined;
}

function reportFrom(form: FormData): number | null {
  return Number(form.get("reportId")) || null;
}

function failure(error: unknown): FormState {
  if (error instanceof Error) return { error: error.message, policy: error.message.startsWith("Política de despesa") };
  throw error;
}

export async function saveExpenseAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const db = await getDb();
  const expenseId = Number(form.get("expenseId"));
  const expense = await getExpense(db, expenseId);
  if (!expense || expense.owner?.id !== user.id) return { error: "Despesa não encontrada." };
  try {
    const receipt = await receiptFrom(form, expenseId);
    await saveExpense(db, {
      expenseId,
      employeeId: user.id,
      categoryId: Number(form.get("categoryId")),
      description: String(form.get("description") ?? ""),
      costCenter: String(form.get("costCenter") ?? ""),
      reportId: form.has("reportId") ? reportFrom(form) : undefined,
      ...(receipt ? { receiptPath: receipt.path, receiptMime: receipt.mime } : {}),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/app", "layout");
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/app/") ? back : "/app?salvo=1");
}

export async function createManualExpenseAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const db = await getDb();
  try {
    const receipt = await receiptFrom(form, `manual-${user.id}`);
    await createManualExpense(db, {
      employeeId: user.id,
      amountCents: parseMoney(String(form.get("amount") ?? "")),
      purchaseDate: String(form.get("purchaseDate") ?? ""),
      merchant: String(form.get("merchant") ?? ""),
      paymentMethod: form.get("paymentMethod") === "adiantamento" ? "adiantamento" : "dinheiro",
      categoryId: Number(form.get("categoryId")),
      description: String(form.get("description") ?? ""),
      costCenter: String(form.get("costCenter") ?? ""),
      reportId: reportFrom(form),
      ...(receipt ? { receiptPath: receipt.path, receiptMime: receipt.mime } : {}),
    });
  } catch (error) {
    if (error instanceof ExpenseError || error instanceof Error) return failure(error);
    throw error;
  }
  revalidatePath("/app", "layout");
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/app/") ? back : "/app/despesas?aba=todas");
}
