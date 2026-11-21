import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { clockMode, now } from "@/lib/clock";
import { longDay } from "@/lib/format";
import { logout } from "@/app/login/actions";
import { moveClock } from "./actions";
import { SidebarNav } from "./sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const db = getDb();
  const unlinked = db.select().from(cards).where(and(isNull(cards.employeeId), eq(cards.isBillingAccount, false))).all().length;
  const simulated = clockMode(db) === "simulado";

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col gap-6 bg-brand-900 p-4 text-white max-lg:hidden">
        <div className="flex items-center gap-2 px-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <div>
            <p className="font-bold leading-tight">AExpenses</p>
            <p className="text-[11px] text-brand-100">Gestão de despesas</p>
          </div>
        </div>
        <SidebarNav unlinked={unlinked} />
        <div className="mt-auto space-y-3">
          {simulated && (
            <div className="rounded-xl bg-white/10 p-3 text-xs">
              <p className="font-semibold text-white">Relógio do piloto</p>
              <p className="mt-0.5 text-brand-100">{longDay(now(db))}</p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {[1, 2, 7].map((d) => (
                  <form key={d} action={moveClock}>
                    <input type="hidden" name="days" value={d} />
                    <button className="w-full rounded-lg bg-white/15 py-1 font-semibold hover:bg-white/25">+{d}d</button>
                  </form>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-2 text-xs text-brand-100">
            <span>{user.name}</span>
            <form action={logout}><button className="underline">Sair</button></form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
