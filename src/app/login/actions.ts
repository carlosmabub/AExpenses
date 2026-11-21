"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { employees } from "@/db/schema";
import { demoMode, endSession, startSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = getDb().select().from(employees).where(eq(employees.email, email)).get();
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) return "E-mail ou senha inválidos.";
  await startSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/app");
}

export async function demoLogin(form: FormData): Promise<void> {
  if (!demoMode()) redirect("/login");
  const user = getDb().select().from(employees).where(eq(employees.id, Number(form.get("id")))).get();
  if (!user?.active) redirect("/login");
  await startSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/app");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
