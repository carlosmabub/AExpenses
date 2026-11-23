"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { House, Menu, Plus } from "lucide-react";

function NavLink({ href, label, Icon, active }: { href: string; label: string; Icon: typeof House; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs transition-colors duration-100 ${active ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Barra inferior do modelo validado: Início, o botão + e Menu. */
export function BottomNav() {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [path]);

  return (
    <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-[var(--z-sticky-nav)] border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-3 items-center">
        <NavLink href="/app" label="Início" Icon={House} active={path === "/app"} />
        <details ref={menu} className="relative flex justify-center">
          <summary
            aria-label="Adicionar"
            className="flex h-14 w-14 -translate-y-5 list-none items-center justify-center rounded-pill bg-ink text-accent-ink shadow-card transition-colors duration-100 hover:bg-accent-deep [&::-webkit-details-marker]:hidden"
          >
            <Plus size={28} aria-hidden="true" />
          </summary>
          <div className="surface-card absolute bottom-16 left-1/2 w-56 -translate-x-1/2 overflow-hidden">
            <Link href="/app/despesas/nova" className="flex min-h-12 items-center px-4 text-ink hover:bg-paper-2">Nova despesa</Link>
            <Link href="/app/relatorios/novo" className="flex min-h-12 items-center border-t border-rule px-4 text-ink hover:bg-paper-2">Novo relatório</Link>
          </div>
        </details>
        <NavLink href="/app/menu" label="Menu" Icon={Menu} active={path !== "/app"} />
      </div>
    </nav>
  );
}
