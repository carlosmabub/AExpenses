import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export default async function ProfilePage() {
  const user = await requireUser();
  const myCards = getDb().select().from(cards).where(eq(cards.employeeId, user.id)).all();
  return (
    <>
      <header className="bg-white px-4 pb-4 pt-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Perfil</h1>
      </header>
      <section className="space-y-4 p-4">
        <div className="card p-4">
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          <p className="mt-2 text-sm">Centro de custo: <strong>{user.costCenter || "—"}</strong></p>
        </div>
        <div className="card p-4">
          <p className="label">Meus cartões</p>
          {myCards.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum cartão vinculado. Fale com o financeiro.</p>
          ) : (
            myCards.map((c) => (
              <div key={c.id} className="mt-2 flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 p-4 text-white">
                <span className="text-sm">Visa Empresarial</span>
                <span className="font-mono">•••• {c.last4}</span>
              </div>
            ))
          )}
        </div>
        <form action={logout}>
          <button className="btn-ghost w-full">Sair</button>
        </form>
      </section>
    </>
  );
}
