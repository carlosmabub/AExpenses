"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { advances, cards, categories, classifications, employees, expenses, importBatches, reports, settings, transactions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { importBvk3, type ImportResult } from "@/lib/bvk3/import";
import { decodeBvk3 } from "@/lib/bvk3/parser";
import { advanceClock, setSetting } from "@/lib/clock";
import { hashPassword } from "@/lib/password";
import { approveRemaining, createAdvance, reviewExpense } from "@/lib/reports";
import { parseMoney } from "@/lib/format";
import { CATEGORY_ICONS } from "@/components/category-icon";

function refresh() {
  revalidatePath("/", "layout");
}

export type ImportState = { result?: ImportResult; fileName?: string; error?: string } | null;

export async function importFile(_: ImportState, form: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha o arquivo BVK3 enviado pelo banco." };
  if (file.size > 20 * 1024 * 1024) return { error: "Arquivo muito grande (máx. 20 MB)." };
  const content = decodeBvk3(new Uint8Array(await file.arrayBuffer()));
  const result = await importBvk3(await getDb(), { fileName: file.name, content, importedBy: admin.id, force: form.get("force") === "1" });
  refresh();
  return { result, fileName: file.name };
}

export async function moveClock(form: FormData): Promise<void> {
  await requireAdmin();
  await advanceClock(await getDb(), Number(form.get("days") ?? 1));
  refresh();
}

export async function setClockMode(form: FormData): Promise<void> {
  await requireAdmin();
  await setSetting(await getDb(), "clock_mode", form.get("mode") === "real" ? "real" : "simulado");
  refresh();
}

export async function setDeadline(form: FormData): Promise<void> {
  await requireAdmin();
  const hours = Number(form.get("hours"));
  if (Number.isFinite(hours) && hours > 0 && hours <= 24 * 30) await setSetting(await getDb(), "deadline_hours", String(Math.round(hours)));
  refresh();
}

/** Apaga importações e despesas (mantém funcionários e categorias) para recomeçar a demonstração. */
export async function resetPilot(): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(expenses).run();
    await tx.delete(advances).run();
    await tx.delete(reports).run();
    await tx.delete(classifications).run();
    await tx.delete(transactions).run();
    await tx.delete(importBatches).run();
    await tx.delete(cards).run();
    await tx.delete(settings).where(inArray(settings.key, ["sim_now"])).run();
  });
  refresh();
}

export async function linkCard(form: FormData): Promise<void> {
  await requireAdmin();
  const employeeId = Number(form.get("employeeId")) || null;
  await (await getDb()).update(cards).set({ employeeId }).where(eq(cards.id, Number(form.get("cardId")))).run();
  refresh();
}

export async function saveEmployee(form: FormData): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  const id = Number(form.get("id")) || null;
  const values = {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    costCenter: String(form.get("costCenter") ?? "").trim(),
    cardHolderName: String(form.get("cardHolderName") ?? "").trim().toUpperCase(),
    role: form.get("role") === "admin" ? ("admin" as const) : ("funcionario" as const),
    active: form.get("active") !== "0",
  };
  if (!values.name || !values.email) return;
  const password = String(form.get("password") ?? "");
  if (id) {
    await db.update(employees).set({ ...values, ...(password ? { passwordHash: hashPassword(password) } : {}) }).where(eq(employees.id, id)).run();
  } else {
    await db.insert(employees).values({ ...values, passwordHash: hashPassword(password || "123456") }).onConflictDoNothing().run();
  }
  refresh();
}

export async function saveCategory(form: FormData): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  const id = Number(form.get("id")) || null;
  const values = {
    name: String(form.get("name") ?? "").trim(),
    icon: CATEGORY_ICONS[String(form.get("icon"))] ? String(form.get("icon")) : "receipt",
    mccs: String(form.get("mccs") ?? "").replace(/[^\d,\-]/g, ""),
    active: form.get("active") !== "0",
    requiresReceipt: form.get("requiresReceipt") !== "0",
  };
  if (!values.name) return;
  if (id) await db.update(categories).set(values).where(eq(categories.id, id)).run();
  else await db.insert(categories).values({ ...values, sortOrder: 100 }).onConflictDoNothing().run();
  refresh();
}

export type AdminFormState = { error: string } | null;

export async function reviewExpenseAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  try {
    await reviewExpense(await getDb(), {
      expenseId: Number(form.get("expenseId")),
      reviewerId: admin.id,
      decision: form.get("decision") === "devolvida" ? "devolvida" : "aprovada",
      comment: String(form.get("comment") ?? ""),
    });
  } catch (error) {
    return { error: (error as Error).message };
  }
  refresh();
  return null;
}

export async function approveRemainingAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  await approveRemaining(await getDb(), { reportId: Number(form.get("reportId")), reviewerId: admin.id });
  refresh();
}

export async function createAdvanceAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  try {
    await createAdvance(await getDb(), {
      employeeId: Number(form.get("employeeId")),
      amountCents: parseMoney(String(form.get("amount") ?? "")),
      date: String(form.get("date") ?? ""),
      description: String(form.get("description") ?? ""),
      createdBy: admin.id,
    });
  } catch (error) {
    return { error: (error as Error).message };
  }
  refresh();
  return null;
}
