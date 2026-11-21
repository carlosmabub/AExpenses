"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { cards, categories, classifications, employees, importBatches, settings, transactions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { importBvk3, type ImportResult } from "@/lib/bvk3/import";
import { decodeBvk3 } from "@/lib/bvk3/parser";
import { advanceClock, setSetting } from "@/lib/clock";
import { hashPassword } from "@/lib/password";

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
  const result = importBvk3(getDb(), { fileName: file.name, content, importedBy: admin.id, force: form.get("force") === "1" });
  refresh();
  return { result, fileName: file.name };
}

export async function moveClock(form: FormData): Promise<void> {
  await requireAdmin();
  advanceClock(getDb(), Number(form.get("days") ?? 1));
  refresh();
}

export async function setClockMode(form: FormData): Promise<void> {
  await requireAdmin();
  setSetting(getDb(), "clock_mode", form.get("mode") === "real" ? "real" : "simulado");
  refresh();
}

export async function setDeadline(form: FormData): Promise<void> {
  await requireAdmin();
  const hours = Number(form.get("hours"));
  if (Number.isFinite(hours) && hours > 0 && hours <= 24 * 30) setSetting(getDb(), "deadline_hours", String(Math.round(hours)));
  refresh();
}

/** Apaga importações e despesas (mantém funcionários e categorias) para recomeçar a demonstração. */
export async function resetPilot(): Promise<void> {
  await requireAdmin();
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(classifications).run();
    tx.delete(transactions).run();
    tx.delete(importBatches).run();
    tx.delete(cards).run();
    tx.delete(settings).where(inArray(settings.key, ["sim_now"])).run();
  });
  refresh();
}

export async function linkCard(form: FormData): Promise<void> {
  await requireAdmin();
  const employeeId = Number(form.get("employeeId")) || null;
  getDb().update(cards).set({ employeeId }).where(eq(cards.id, Number(form.get("cardId")))).run();
  refresh();
}

export async function saveEmployee(form: FormData): Promise<void> {
  await requireAdmin();
  const db = getDb();
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
    db.update(employees).set({ ...values, ...(password ? { passwordHash: hashPassword(password) } : {}) }).where(eq(employees.id, id)).run();
  } else {
    db.insert(employees).values({ ...values, passwordHash: hashPassword(password || "123456") }).onConflictDoNothing().run();
  }
  refresh();
}

export async function saveCategory(form: FormData): Promise<void> {
  await requireAdmin();
  const db = getDb();
  const id = Number(form.get("id")) || null;
  const values = {
    name: String(form.get("name") ?? "").trim(),
    icon: String(form.get("icon") ?? "").trim() || "🧾",
    mccs: String(form.get("mccs") ?? "").replace(/[^\d,\-]/g, ""),
    active: form.get("active") !== "0",
  };
  if (!values.name) return;
  if (id) db.update(categories).set(values).where(eq(categories.id, id)).run();
  else db.insert(categories).values({ ...values, sortOrder: 100 }).onConflictDoNothing().run();
  refresh();
}
