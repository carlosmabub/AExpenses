import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { clockMode, now } from "@/lib/clock";
import { listEmployeeExpenses } from "@/lib/expenses";
import { longDay } from "@/lib/format";
import { BottomNav } from "./bottom-nav";

export const dynamic = "force-dynamic";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const pending = (await listEmployeeExpenses(db, user.id)).filter((e) => e.status === "sem_relatorio" || e.status === "devolvida").length;
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-32">
      {(await clockMode(db)) === "simulado" && (
        <p className="pt-3 text-xs text-muted">piloto: hoje é {longDay(await now(db)).toLowerCase()}</p>
      )}
      <main id="main">{children}</main>
      <BottomNav pending={pending} />
    </div>
  );
}
