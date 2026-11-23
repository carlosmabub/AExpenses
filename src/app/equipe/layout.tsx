import Link from "next/link";
import { getDb } from "@/db";
import { requireApprover } from "@/lib/auth";
import { pendingApprovals } from "@/lib/people";
import { logout } from "@/app/login/actions";
import { EquipeNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function EquipeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireApprover();
  const waiting = await pendingApprovals(await getDb(), user);
  return (
    <div className="min-h-dvh">
      <a href="#main" className="visually-hidden focus:not-sr-only">Ir para o conteúdo</a>
      <header className="sticky top-0 z-[var(--z-sticky-nav)] border-b border-rule bg-paper">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-6">
          <Link href="/equipe" className="flex items-center gap-2" aria-label="Minha equipe">
            <img src="/icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
            <span className="head text-lg text-ink">minha equipe</span>
          </Link>
          <EquipeNav waiting={waiting} />
          <div className="ml-auto flex items-center gap-1">
            <Link href="/app" className="link flex min-h-10 items-center px-2 font-display text-sm lowercase text-muted">meu app</Link>
            {user.role === "admin" && <Link href="/admin" className="link flex min-h-10 items-center px-2 font-display text-sm lowercase text-muted">painel</Link>}
            <form action={logout}><button type="submit" className="link min-h-10 px-2 font-display text-sm lowercase text-muted">sair</button></form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
