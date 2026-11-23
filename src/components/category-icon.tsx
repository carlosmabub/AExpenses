import {
  Banknote, BedDouble, Briefcase, Building, Car, Cog, Fuel, HardHat, Package, Paperclip, Plane, Receipt, Settings, SquareParking, Ticket, Truck, Utensils, Wrench,
  type LucideIcon,
} from "lucide-react";

/** Ícones que o admin pode escolher para uma categoria (o banco guarda o nome). */
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  utensils: { icon: Utensils, label: "talheres" },
  bed: { icon: BedDouble, label: "cama" },
  fuel: { icon: Fuel, label: "bomba de combustível" },
  car: { icon: Car, label: "carro" },
  parking: { icon: SquareParking, label: "estacionamento" },
  plane: { icon: Plane, label: "avião" },
  paperclip: { icon: Paperclip, label: "clipe" },
  banknote: { icon: Banknote, label: "dinheiro" },
  package: { icon: Package, label: "caixa" },
  cog: { icon: Cog, label: "engrenagem" },
  wrench: { icon: Wrench, label: "chave inglesa" },
  "hard-hat": { icon: HardHat, label: "capacete" },
  settings: { icon: Settings, label: "ajustes" },
  building: { icon: Building, label: "prédio" },
  truck: { icon: Truck, label: "caminhão" },
  briefcase: { icon: Briefcase, label: "maleta" },
  ticket: { icon: Ticket, label: "ingresso" },
  receipt: { icon: Receipt, label: "recibo" },
};

export function CategoryIcon({ name, size = 20, className }: { name?: string | null; size?: number; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]?.icon) || Receipt;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" className={className} />;
}
