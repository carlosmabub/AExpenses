import { Banknote, BedDouble, Car, Fuel, Paperclip, Plane, Receipt, SquareParking, Utensils, type LucideIcon } from "lucide-react";

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
  receipt: { icon: Receipt, label: "recibo" },
};

export function CategoryIcon({ name, size = 20, className }: { name?: string | null; size?: number; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]?.icon) || Receipt;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" className={className} />;
}
