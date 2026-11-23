"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function EquipeNav({ waiting }: { waiting: number }) {
  const path = usePathname();
  const items = [
    // O dashboard fica fora do celular: lá o líder só aprova (abre pelo link no navegador do computador)
    { href: "/equipe", label: "dashboard", active: path === "/equipe", hideOnPhone: true },
    { href: "/equipe/aprovacoes", label: "aprovações", active: path.startsWith("/equipe/aprovacoes"), hideOnPhone: false },
  ];
  return (
    <nav aria-label="Minha equipe" className="flex gap-0.5">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.active ? "page" : undefined}
          className={`${i.hideOnPhone ? "max-sm:hidden " : ""}flex min-h-10 items-center gap-2 rounded-pill px-3 font-display text-sm lowercase ${i.active ? "bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-2"}`}>
          {i.label}
          {i.href.endsWith("aprovacoes") && waiting > 0 && (
            <span className="rounded-pill bg-accent px-1.5 text-[11px] leading-5 text-accent-ink tabular-nums">{waiting}<span className="visually-hidden"> relatórios para aprovar</span></span>
          )}
        </Link>
      ))}
    </nav>
  );
}
