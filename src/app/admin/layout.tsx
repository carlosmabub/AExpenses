import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { Menu } from "lucide-react";
import { getDb } from "@/db";
import { cards, reports } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { clockMode, now } from "@/lib/clock";
import { date } from "@/lib/format";
import { logout } from "@/app/login/actions";
import { moveClock } from "./actions";
import { SidebarNav } from "./sidebar";

export const dynamic = "force-dynamic";

function PilotClock({ day }: { day: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-sm text-ink-2" title="Relógio do piloto">piloto: {day}</span>
      {[1, 2, 7].map((d) => (
        <form key={d} action={moveClock}>
          <input type="hidden" name="days" value={d} />
          <button type="submit" className="pill min-h-8 px-3 hover:bg-paper-2" aria-label={`Avançar ${d} dia${d > 1 ? "s" : ""}`}>
            +{d}d
          </button>
        </form>
      ))}
    </div>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const db = await getDb();
  const unlinked = (await db.select().from(cards).where(and(isNull(cards.employeeId), eq(cards.isBillingAccount, false))).all()).length;
  const toApprove = (await db.select({ id: reports.id }).from(reports).where(eq(reports.status, "enviado")).all()).length;
  const simulated = (await clockMode(db)) === "simulado";
  const day = date((await now(db)).toISOString());

  return (
    <div className="min-h-dvh">
      <a href="#main" className="visually-hidden focus:not-sr-only">Ir para o conteúdo</a>
      <header className="sticky top-0 z-[var(--z-sticky-nav)] border-b border-rule bg-paper">
        <div className="mx-auto flex min-h-16 max-w-[1360px] items-center gap-4 px-6">
          <Link href="/admin" aria-label="AExpenses, dashboard" className="flex items-center gap-2">
            <img src="/icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
            <span className="head text-lg text-ink">aexpenses</span>
          </Link>

          <nav aria-label="Painel" className="hidden xl:block">
            <SidebarNav unlinked={unlinked} toApprove={toApprove} />
          </nav>

          <div className="ml-auto hidden items-center gap-3 xl:flex">
            {simulated && <PilotClock day={day} />}
            <form action={logout}>
              <button type="submit" className="link font-display text-sm lowercase text-muted" title={user.name}>sair</button>
            </form>
          </div>

          <details className="group relative ml-auto xl:hidden">
            <summary className="btn-ghost list-none px-4 [&::-webkit-details-marker]:hidden">
              <Menu size={18} aria-hidden="true" /> menu
              {unlinked + toApprove > 0 && <span className="rounded-pill bg-accent px-1.5 text-[11px] leading-5 text-accent-ink">{unlinked + toApprove}</span>}
            </summary>
            <div className="well absolute right-0 top-12 z-[var(--z-dropdown)] w-72 p-3 shadow-card">
              <nav aria-label="Painel">
                <SidebarNav unlinked={unlinked} toApprove={toApprove} stacked />
              </nav>
              {simulated && (
                <div className="mt-3 border-t border-rule pt-3">
                  <PilotClock day={day} />
                </div>
              )}
              <form action={logout} className="mt-3 border-t border-rule pt-3">
                <button type="submit" className="btn-ghost w-full">sair ({user.name.toLowerCase()})</button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1360px] px-6 py-10">{children}</main>
    </div>
  );
}
