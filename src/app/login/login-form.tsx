"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">e-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required aria-invalid={error ? true : undefined} />
      </div>
      <div>
        <label className="label" htmlFor="password">senha</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={error ? true : undefined} />
      </div>
      <p className="min-h-[1lh] text-sm text-error" aria-live="polite">{error}</p>
      <button type="submit" className="btn-primary w-full" disabled={pending} aria-busy={pending}>{pending ? "entrando…" : "entrar"}</button>
    </form>
  );
}
