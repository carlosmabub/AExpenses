"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { FolderOpen, House, Plus, ReceiptText, UserRound } from "lucide-react";

const LEFT = [
  { href: "/app", label: "início", Icon: House },
  { href: "/app/despesas", label: "despesas", Icon: ReceiptText },
];
const RIGHT = [
  { href: "/app/relatorios", label: "relatórios", Icon: FolderOpen },
  { href: "/app/perfil", label: "perfil", Icon: UserRound },
];

function NavLink({ href, label, Icon, badge }: { href: string; label: string; Icon: typeof House; badge?: number }) {
  const path = usePathname();
  const active = href === "/app" ? path === "/app" : path.startsWith(href) && !path.endsWith("/nova") && !path.endsWith("/novo");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-1 font-display text-xs lowercase transition-colors duration-100 ${active ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
      {label}
      {!!badge && (
        <span className="absolute left-[calc(50%+6px)] top-1.5 min-w-5 rounded-pill bg-accent px-1.5 text-center text-[11px] leading-5 text-accent-ink tabular-nums">
          {badge}
          <span className="visually-hidden"> pendentes</span>
        </span>
      )}
    </Link>
  );
}

export function BottomNav({ pending }: { pending: number }) {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [path]);

  return (
    <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-[var(--z-sticky-nav)] border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-5 items-center">
        {LEFT.map((item) => (
          <NavLink key={item.href} {...item} badge={item.href === "/app/despesas" ? pending : undefined} />
        ))}
        <details ref={menu} className="relative flex justify-center">
          <summary className="flex h-14 w-14 -translate-y-4 list-none items-center justify-center rounded-pill bg-accent text-accent-ink shadow-card transition-colors duration-100 hover:bg-accent-deep [&::-webkit-details-marker]:hidden" aria-label="Adicionar">
            <Plus size={26} aria-hidden="true" />
          </summary>
          <div className="well absolute bottom-16 left-1/2 w-56 -translate-x-1/2 p-2 shadow-card">
            <Link href="/app/despesas/nova" className="flex min-h-12 items-center rounded-pill px-4 font-display text-sm lowercase text-ink hover:bg-paper-3">nova despesa</Link>
            <Link href="/app/relatorios/novo" className="flex min-h-12 items-center rounded-pill px-4 font-display text-sm lowercase text-ink hover:bg-paper-3">novo relatório</Link>
          </div>
        </details>
        {RIGHT.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </div>
    </nav>
  );
}
