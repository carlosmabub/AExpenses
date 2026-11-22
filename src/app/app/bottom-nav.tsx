"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ReceiptText, UserRound } from "lucide-react";

const ITEMS = [
  { href: "/app", label: "início", Icon: House },
  { href: "/app/despesas", label: "despesas", Icon: ReceiptText },
  { href: "/app/perfil", label: "perfil", Icon: UserRound },
];

export function BottomNav({ pending }: { pending: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-[var(--z-sticky-nav)] border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/app" ? path === "/app" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 font-display text-xs lowercase transition-colors duration-100 ${active ? "text-accent" : "text-muted hover:text-ink"}`}
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              {label}
              {href === "/app/despesas" && pending > 0 && (
                <span className="absolute left-[calc(50%+6px)] top-1.5 min-w-5 rounded-pill bg-accent px-1.5 text-center text-[11px] leading-5 text-accent-ink tabular-nums">
                  {pending}
                  <span className="visually-hidden"> para classificar</span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
