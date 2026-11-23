"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { moveExpensesToReport } from "@/lib/expenses";
import { createReport, submitReport, updateReport } from "@/lib/reports";

export type ReportFormState = { error: string } | null;

function readInput(form: FormData, employeeId: number) {
  return {
    employeeId,
    name: String(form.get("name") ?? ""),
    costCenter: String(form.get("costCenter") ?? ""),
    notes: String(form.get("notes") ?? ""),
    advanceIds: form.getAll("advanceIds").map(Number).filter(Boolean),
  };
}

export async function createReportAction(_: ReportFormState, form: FormData): Promise<ReportFormState> {
  const user = await requireUser();
  let id: number;
  try {
    id = await createReport(await getDb(), readInput(form, user.id));
  } catch (error) {
    return { error: (error as Error).message };
  }
  revalidatePath("/app", "layout");
  redirect(`/app/relatorios/${id}`);
}

export async function updateReportAction(_: ReportFormState, form: FormData): Promise<ReportFormState> {
  const user = await requireUser();
  const id = Number(form.get("reportId"));
  try {
    await updateReport(await getDb(), id, readInput(form, user.id));
  } catch (error) {
    return { error: (error as Error).message };
  }
  revalidatePath("/app", "layout");
  return null;
}

export async function addExpensesAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const reportId = Number(form.get("reportId"));
  await moveExpensesToReport(await getDb(), { employeeId: user.id, reportId, expenseIds: form.getAll("expenseIds").map(Number).filter(Boolean) });
  revalidatePath("/app", "layout");
  redirect(`/app/relatorios/${reportId}`);
}

export async function removeExpenseAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await moveExpensesToReport(await getDb(), { employeeId: user.id, reportId: null, expenseIds: [Number(form.get("expenseId"))] });
  revalidatePath("/app", "layout");
}

export async function submitReportAction(_: ReportFormState, form: FormData): Promise<ReportFormState> {
  const user = await requireUser();
  try {
    await submitReport(await getDb(), { reportId: Number(form.get("reportId")), employeeId: user.id });
  } catch (error) {
    return { error: (error as Error).message };
  }
  revalidatePath("/app", "layout");
  return null;
}
