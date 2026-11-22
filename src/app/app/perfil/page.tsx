import { eq } from "drizzle-orm";
import { CreditCard } from "lucide-react";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export default async function ProfilePage() {
  const user = await requireUser();
  const myCards = await (await getDb()).select().from(cards).where(eq(cards.employeeId, user.id)).all();
  return (
    <>
      <h1 className="head pt-6 text-3xl text-ink">perfil</h1>
      <dl className="mt-6 space-y-3 border-y border-rule py-4 text-sm">
        <div><dt className="label">nome</dt><dd className="text-base text-ink">{user.name}</dd></div>
        <div><dt className="label">e-mail</dt><dd className="text-ink">{user.email}</dd></div>
        <div><dt className="label">centro de custo</dt><dd className="text-ink">{user.costCenter || "não informado"}</dd></div>
      </dl>

      <section className="mt-8" aria-labelledby="cartoes">
        <h2 id="cartoes" className="head text-xl text-ink">meus cartões</h2>
        {myCards.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum cartão vinculado. Fale com o financeiro.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {myCards.map((c) => (
              <li key={c.id} className="well flex items-center justify-between p-4">
                <span className="flex items-center gap-2 text-sm text-ink-2">
                  <CreditCard size={18} strokeWidth={1.75} aria-hidden="true" /> Visa empresarial
                </span>
                <span className="tabular-nums text-ink">final {c.last4}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={logout} className="mt-8">
        <button type="submit" className="btn-ghost w-full">sair</button>
      </form>
    </>
  );
}
