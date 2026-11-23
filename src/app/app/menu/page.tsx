import Link from "next/link";
import { ChevronRight, FolderOpen, LogOut, ReceiptText, UserRound } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { listEmployeeExpenses } from "@/lib/expenses";
import { listEmployeeReports } from "@/lib/reports";
import { logout } from "@/app/login/actions";
import { TopBar } from "@/components/mobile/top-bar";

export default async function MenuPage() {
  const user = await requireUser();
  const db = await getDb();
  const pending = (await listEmployeeExpenses(db, user.id)).filter((e) => e.status === "sem_relatorio" || e.status === "devolvida").length;
  const reports = (await listEmployeeReports(db, user.id)).filter((r) => r.stage !== "aprovado").length;
  const items = [
    { href: "/app/despesas", label: "Despesas", Icon: ReceiptText, count: pending },
    { href: "/app/relatorios", label: "Relatórios", Icon: FolderOpen, count: reports },
    { href: "/app/perfil", label: "Perfil", Icon: UserRound, count: 0 },
  ];
  return (
    <>
      <TopBar title="Menu" />
      <ul className="surface-card -mt-3 overflow-hidden">
        {items.map(({ href, label, Icon, count }) => (
          <li key={href} className="border-b border-rule last:border-b-0">
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-paper-2/60">
              <span className="icon-tile"><Icon size={20} strokeWidth={1.75} aria-hidden="true" /></span>
              <span className="flex-1 text-ink">{label}</span>
              {count > 0 && <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-pill bg-accent-soft px-2 text-sm tabular-nums">{count}</span>}
              <ChevronRight size={18} aria-hidden="true" className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout} className="mt-4">
        <button type="submit" className="surface-card flex min-h-14 w-full items-center gap-3 px-4 text-left text-ink hover:bg-paper-2/60">
          <span className="icon-tile"><LogOut size={20} strokeWidth={1.75} aria-hidden="true" /></span>
          Sair
        </button>
      </form>
    </>
  );
}
