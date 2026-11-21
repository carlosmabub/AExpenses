"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Início", icon: "🏠" },
  { href: "/app/despesas", label: "Despesas", icon: "🧾" },
  { href: "/app/perfil", label: "Perfil", icon: "👤" },
];

export function BottomNav({ pending }: { pending: number }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {ITEMS.map((item) => {
          const active = item.href === "/app" ? path === "/app" : path.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`relative flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "font-semibold text-brand-600" : "text-slate-500"}`}>
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
              {item.href === "/app/despesas" && pending > 0 && (
                <span className="absolute right-[30%] top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{pending}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
