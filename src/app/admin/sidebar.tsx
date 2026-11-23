"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "dashboard" },
  { href: "/admin/aprovacoes", label: "aprovações" },
  { href: "/admin/transacoes", label: "despesas" },
  { href: "/admin/adiantamentos", label: "adiantamentos" },
  { href: "/admin/importar", label: "importar" },
  { href: "/admin/cadastro", label: "cadastro" },
  { href: "/admin/categorias", label: "tipos" },
  { href: "/admin/exportar", label: "exportar" },
];

/** Links do painel: na barra do topo no computador, dentro do menu no celular. */
export function SidebarNav({ unlinked, toApprove = 0, stacked = false }: { unlinked: number; toApprove?: number; stacked?: boolean }) {
  const path = usePathname();
  return (
    <ul className={stacked ? "flex flex-col" : "flex items-center gap-0.5"}>
      {ITEMS.map((item) => {
        const active = item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center gap-2 rounded-pill px-2.5 font-display text-sm lowercase transition-colors duration-100 ${
                active ? "bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-2"
              } ${stacked ? "min-h-12" : ""}`}
            >
              {item.label}
              {item.href === "/admin/aprovacoes" && toApprove > 0 && (
                <span className="rounded-pill bg-accent px-1.5 text-[11px] leading-5 text-accent-ink tabular-nums">
                  {toApprove}
                  <span className="visually-hidden"> relatórios para aprovar</span>
                </span>
              )}
              {item.href === "/admin/cadastro" && unlinked > 0 && (
                <span className="rounded-pill bg-accent px-1.5 text-[11px] leading-5 text-accent-ink tabular-nums">
                  {unlinked}
                  <span className="visually-hidden"> cartões não vinculados</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
