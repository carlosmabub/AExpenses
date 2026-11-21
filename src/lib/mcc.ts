/**
 * Sugestão de categoria a partir do MCC (ramo de atividade) que vem no arquivo.
 * Cada categoria guarda uma lista de MCCs no formato "5411,5812-5814,3000-3299".
 */

export function normalizeMcc(mcc: string): string {
  const digits = mcc.replace(/\D/g, "");
  if (!digits) return "";
  return String(Number.parseInt(digits, 10)).padStart(4, "0");
}

type Range = [number, number];

export function parseMccSpec(spec: string): Range[] {
  return spec
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part): Range[] => {
      const [a, b] = part.split("-").map((n) => Number.parseInt(n, 10));
      if (Number.isNaN(a)) return [];
      return [[a, b === undefined || Number.isNaN(b) ? a : b]];
    });
}

export function mccMatches(spec: string, mcc: string): boolean {
  const code = Number.parseInt(normalizeMcc(mcc), 10);
  if (Number.isNaN(code)) return false;
  return parseMccSpec(spec).some(([from, to]) => code >= from && code <= to);
}

export interface CategoryLike {
  id: number;
  mccs: string;
  active: boolean;
}

export function suggestCategory<T extends CategoryLike>(categories: T[], mcc: string): T | undefined {
  return categories.find((c) => c.active && c.mccs && mccMatches(c.mccs, mcc));
}

/** Categorias padrão do piloto (viagem), editáveis no painel do admin. */
export const DEFAULT_CATEGORIES: { name: string; icon: string; mccs: string }[] = [
  { name: "Alimentação", icon: "🍽️", mccs: "5411,5422,5441,5451,5462,5499,5811-5814,5300" },
  { name: "Hospedagem", icon: "🏨", mccs: "3501-3999,7011,7012" },
  { name: "Combustível", icon: "⛽", mccs: "5541,5542,5983" },
  { name: "Transporte", icon: "🚕", mccs: "4111,4121,4131,4789,3351-3500,7512,7513" },
  { name: "Pedágio/Estacionamento", icon: "🅿️", mccs: "4784,7523" },
  { name: "Passagem aérea", icon: "✈️", mccs: "3000-3299,4511,4722" },
  { name: "Material/Escritório", icon: "📎", mccs: "5111,5943,5044,5045" },
  { name: "Saque", icon: "🏧", mccs: "6010,6011" },
  { name: "Outros", icon: "🧾", mccs: "" },
];
