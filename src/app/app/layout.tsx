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
  const pending = (await listEmployeeExpenses(db, user.id)).filter((e) => e.status === "pendente").length;
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      {(await clockMode(db)) === "simulado" && (
        <div className="bg-brand-900 px-4 py-1.5 text-center text-[11px] text-brand-100">
          Piloto · hoje é {longDay(await now(db)).toLowerCase()}
        </div>
      )}
      {children}
      <BottomNav pending={pending} />
    </div>
  );
}
