"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { advances, cards, categories, classifications, expenses, importBatches, reports, settings, transactions } from "@/db/schema";
import { requireAdmin, requireApprover } from "@/lib/auth";
import { importBvk3, type ImportResult } from "@/lib/bvk3/import";
import { decodeBvk3 } from "@/lib/bvk3/parser";
import { advanceClock, DAILY_FILE_HOUR_UTC, forgetSettings, setClock, setSetting } from "@/lib/clock";
import { linkCardTo } from "@/lib/people";
import { PILOT_USER } from "@/db/seed";
import { approveExpenses, createAdvance, reviewExpense } from "@/lib/reports";
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
  const result = await importBvk3(await getDb(), { fileName: file.name, content, importedBy: admin.id, force: form.get("force") === "1", singleCardHolder: form.get("singleCard") === "1" ? PILOT_USER.holder : undefined, shiftDatesTo: form.get("shiftDates") === "1" ? new Date() : undefined });
  refresh();
  return { result, fileName: file.name };
}

/** Leva o relógio do piloto para uma data digitada, às 08:00 de Brasília (quando o arquivo diário chega). */
export async function setClockDate(form: FormData): Promise<void> {
  await requireAdmin();
  const value = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const [y, m, d] = value.split("-").map(Number);
  await setClock(await getDb(), new Date(Date.UTC(y, m - 1, d, DAILY_FILE_HOUR_UTC)));
  refresh();
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
  forgetSettings();
  refresh();
}

export async function linkCard(form: FormData): Promise<void> {
  await requireAdmin();
  await linkCardTo(await getDb(), Number(form.get("cardId")), Number(form.get("employeeId")) || null);
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
  const admin = await requireApprover();
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

export async function approveSelectedAction(form: FormData): Promise<void> {
  const reviewer = await requireApprover();
  const expenseIds = form.getAll("expenseIds").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  try {
    await approveExpenses(await getDb(), { expenseIds, reviewerId: reviewer.id });
  } catch {
    // sem permissão ou nada marcado: a tela só recarrega
  }
  refresh();
}
