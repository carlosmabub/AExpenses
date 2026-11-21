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

function getSetting(db: Db, key: string): string | undefined {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function clockMode(db: Db): ClockMode {
  return getSetting(db, "clock_mode") === "real" ? "real" : "simulado";
}

export function simulatedNow(db: Db): string | undefined {
  return getSetting(db, "sim_now");
}

export function now(db: Db): Date {
  if (clockMode(db) === "simulado") {
    const sim = simulatedNow(db);
    if (sim) return new Date(sim);
  }
  return new Date();
}

export function deadlineHours(db: Db): number {
  const value = Number.parseInt(getSetting(db, "deadline_hours") ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DEADLINE_HOURS;
}

export function advanceClock(db: Db, days: number): Date {
  const next = new Date(now(db).getTime() + days * 24 * 3600 * 1000);
  setSetting(db, "sim_now", next.toISOString());
  return next;
}

export function setClock(db: Db, date: Date): void {
  setSetting(db, "sim_now", date.toISOString());
}

/** Dia seguinte à data de postagem, às 08:00 de Brasília: quando o arquivo D+1 chegaria. */
export function dailyFileAvailability(postingDate: string): Date {
  const [y, m, d] = postingDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, DAILY_FILE_HOUR_UTC, 0, 0));
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600 * 1000);
}
