const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(cents: number): string {
  return brl.format(cents / 100);
}

/** yyyy-mm-dd -> dd/mm/yyyy */
export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const tz = "America/Sao_Paulo";

export function dateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function longDay(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = d.toLocaleDateString("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "vence em 1d 4h" / "venceu" */
export function timeLeft(dueAt: string, now: Date): string {
  const ms = new Date(dueAt).getTime() - now.getTime();
  if (ms <= 0) return "prazo vencido";
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "vence em menos de 1h";
  if (hours < 24) return `vence em ${hours}h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `vence em ${days}d ${hours % 24}h` : `vence em ${days}d`;
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s|\*)\S/g, (c) => c.toUpperCase());
}

export function installmentLabel(installment: number, total: number): string | null {
  return total > 1 ? `Parcela ${installment}/${total}` : null;
}
