import { eq } from "drizzle-orm";
import { Building2, CreditCard, Mail, UserRound } from "lucide-react";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { TopBar } from "@/components/mobile/top-bar";

export default async function ProfilePage() {
  const user = await requireUser();
  const myCards = await (await getDb()).select().from(cards).where(eq(cards.employeeId, user.id)).all();
  const rows: [typeof Mail, string, string][] = [
    [UserRound, "Nome", user.name],
    [Mail, "E-mail", user.email],
    [Building2, "Centro de custos", user.costCenter || "Não informado"],
    ...myCards.map((c): [typeof Mail, string, string] => [CreditCard, "Cartão corporativo", `•••• ${c.last4}`]),
  ];
  return (
    <>
      <TopBar title="Perfil" back="/app/menu" />
      <section className="surface-card -mt-3 px-4">
        {rows.map(([Icon, label, value], i) => (
          <div key={`${label}-${i}`} className="form-row last:border-b-0">
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            <span className="shrink-0">{label}</span>
            <span className="min-w-0 flex-1 truncate text-right text-muted">{value}</span>
          </div>
        ))}
      </section>
      {myCards.length === 0 && <p className="mt-3 text-center text-sm text-muted">Nenhum cartão vinculado. Fale com o financeiro.</p>}
    </>
  );
}
