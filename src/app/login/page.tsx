import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { employees } from "@/db/schema";
import { demoMode } from "@/lib/auth";
import { demoLogin } from "./actions";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const demoUsers = demoMode()
    ? getDb().select().from(employees).orderBy(asc(employees.role), asc(employees.name)).all().filter((e) => e.active)
    : [];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
        <h1 className="text-2xl font-bold text-slate-900">AExpenses</h1>
        <p className="text-sm text-slate-500">Prestação de contas dos cartões corporativos</p>
      </div>
      <div className="card p-6">
        <LoginForm />
      </div>
      {demoUsers.length > 0 && (
        <div className="card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Piloto · entrar como</p>
          <div className="grid grid-cols-2 gap-2">
            {demoUsers.map((u) => (
              <form key={u.id} action={demoLogin}>
                <input type="hidden" name="id" value={u.id} />
                <button className="w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-sm ring-1 ring-slate-200 hover:bg-brand-50">
                  <span className="block font-medium text-slate-800">{u.name}</span>
                  <span className="text-xs text-slate-500">{u.role === "admin" ? "Admin · desktop" : "Funcionário · celular"}</span>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
