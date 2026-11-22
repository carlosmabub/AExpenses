import { eq } from "drizzle-orm";
import type { DbLike as Db } from "@/db";
import { settings } from "@/db/schema";

/**
 * Relógio do piloto. Em modo "simulado" o sistema usa uma data controlada pelo admin,
 * para demonstrar o fluxo do arquivo diário com o arquivo de exemplo mensal.
 * Em modo "real" usa o relógio do servidor.
 */
export type ClockMode = "simulado" | "real";

export const DEFAULT_DEADLINE_HOURS = 48;
/** Horário (Brasília) em que o arquivo diário fica disponível no modo simulado */
export const DAILY_FILE_HOUR_UTC = 11; // 08:00 em Brasília (UTC-3)

async function getSetting(db: Db, key: string): Promise<string | undefined> {
  return (await db.select().from(settings).where(eq(settings.key, key)).get())?.value;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export async function clockMode(db: Db): Promise<ClockMode> {
  return (await getSetting(db, "clock_mode")) === "real" ? "real" : "simulado";
}

export function simulatedNow(db: Db): Promise<string | undefined> {
  return getSetting(db, "sim_now");
}

export async function now(db: Db): Promise<Date> {
  if ((await clockMode(db)) === "simulado") {
    const sim = await simulatedNow(db);
    if (sim) return new Date(sim);
  }
  return new Date();
}

export async function deadlineHours(db: Db): Promise<number> {
  const value = Number.parseInt((await getSetting(db, "deadline_hours")) ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DEADLINE_HOURS;
}

export async function advanceClock(db: Db, days: number): Promise<Date> {
  const next = new Date((await now(db)).getTime() + days * 24 * 3600 * 1000);
  await setSetting(db, "sim_now", next.toISOString());
  return next;
}

export async function setClock(db: Db, date: Date): Promise<void> {
  await setSetting(db, "sim_now", date.toISOString());
}

/** Dia seguinte à data de postagem, às 08:00 de Brasília: quando o arquivo D+1 chegaria. */
export function dailyFileAvailability(postingDate: string): Date {
  const [y, m, d] = postingDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, DAILY_FILE_HOUR_UTC, 0, 0));
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600 * 1000);
}
