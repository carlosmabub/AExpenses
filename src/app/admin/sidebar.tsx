"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/importar", label: "Importar arquivo", icon: "📥" },
  { href: "/admin/transacoes", label: "Despesas", icon: "🧾" },
  { href: "/admin/funcionarios", label: "Funcionários e cartões", icon: "👥" },
  { href: "/admin/categorias", label: "Categorias", icon: "🏷️" },
  { href: "/admin/exportar", label: "Exportar Excel", icon: "📤" },
];

export function SidebarNav({ unlinked }: { unlinked: number }) {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {ITEMS.map((item) => {
        const active = item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${active ? "bg-white/15 font-semibold text-white" : "text-brand-100 hover:bg-white/10"}`}
          >
            <span>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.href === "/admin/funcionarios" && unlinked > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">{unlinked}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
