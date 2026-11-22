import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { employees, type Employee } from "@/db/schema";
import { serverSecret } from "./secrets";

const COOKIE = "aex_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): string {
  return serverSecret("AEX_SESSION_SECRET", "aexpenses-dev-session-secret");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function startSession(employeeId: number): Promise<void> {
  const value = String(employeeId);
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<Employee | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [value, signature] = raw.split(".");
  if (!value || !signature) return null;
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const user = await (await getDb()).select().from(employees).where(eq(employees.id, Number(value))).get();
  return user?.active ? user : null;
}

export async function requireUser(): Promise<Employee> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<Employee> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/app");
  return user;
}

/** Login rápido de demonstração (piloto). Desligue com AEX_DEMO=0. */
export function demoMode(): boolean {
  return process.env.AEX_DEMO !== "0";
}
