import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { employees } from "@/db/schema";
import { demoMode } from "@/lib/auth";
import { demoLogin } from "./actions";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const demoUsers = demoMode()
    ? (await (await getDb()).select().from(employees).orderBy(asc(employees.role), asc(employees.name)).all()).filter((e) => e.active)
    : [];
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <img src="/icon.svg" alt="" width={48} height={48} className="h-12 w-12" />
      <h1 className="head mt-5 text-3xl text-ink">aexpenses</h1>
      <p className="mt-2 text-muted">Prestação de contas dos cartões corporativos.</p>

      <div className="well mt-8 p-5">
        <LoginForm />
      </div>

      {demoUsers.length > 0 && (
        <section className="mt-10" aria-labelledby="demo">
          <h2 id="demo" className="head text-lg text-ink">piloto: entrar como</h2>
          <ul className="mt-2 border-t border-rule">
            {demoUsers.map((u) => (
              <li key={u.id} className="border-b border-rule">
                <form action={demoLogin}>
                  <input type="hidden" name="id" value={u.id} />
                  <button type="submit" className="flex min-h-12 w-full items-center justify-between gap-3 text-left transition-colors duration-100 hover:bg-paper-2/60">
                    <span className="text-ink">{u.name}</span>
                    <span className="text-sm text-muted">{u.role === "admin" ? "financeiro, no computador" : "funcionário, no celular"}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
