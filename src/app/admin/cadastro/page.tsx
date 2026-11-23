import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { PageTitle } from "@/components/page-title";
import { date } from "@/lib/format";
import { listPeople, ROLE_LABELS } from "@/lib/people";
import { linkCard } from "../actions";

type Search = { situacao?: string; q?: string };

const TABS = [
  { value: "ativos", label: "ativos" },
  { value: "desligados", label: "desligados" },
  { value: "todos", label: "todos" },
];

export default async function CadastroPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const situacao = TABS.some((t) => t.value === sp.situacao) ? sp.situacao! : "ativos";
  const q = (sp.q ?? "").trim().toLowerCase();
  const db = await getDb();
  const [people, allCards] = await Promise.all([listPeople(db), db.select().from(cards).orderBy(asc(cards.holderName)).all()]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const realCards = allCards.filter((c) => !c.isBillingAccount);
  const unlinked = realCards.filter((c) => !c.employeeId);
  const assignable = people.filter((p) => p.active);
  const rows = people
    .filter((p) => (situacao === "todos" ? true : situacao === "ativos" ? p.active : !p.active))
    .filter((p) => !q || `${p.name} ${p.email} ${p.costCenter}`.toLowerCase().includes(q));

  return (
    <>
      <PageTitle title="usuários" subtitle="Usuários, perfis, líderes, cartões e centro de custo. Quem sai da empresa é desligado e o histórico continua aqui.">
        <Link href="/admin/cadastro/novo" className="btn-primary"><Plus size={16} aria-hidden="true" /> novo usuário</Link>
      </PageTitle>

      {unlinked.length > 0 && (
        <section className="well mb-10 p-5" aria-labelledby="nao-vinculados">
          <h2 id="nao-vinculados" className="head text-xl text-ink">{unlinked.length} cart{unlinked.length > 1 ? "ões" : "ão"} sem funcionário</h2>
          <p className="mt-1 text-sm text-ink-2">As compras destes cartões não aparecem para ninguém no app até serem vinculadas.</p>
          <ul className="mt-4 border-t border-rule">
            {unlinked.map((c) => (
              <li key={c.id} className="border-b border-rule py-3">
                <form action={linkCard} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="cardId" value={c.id} />
                  <span className="text-ink">{c.holderName}</span>
                  <span className="text-sm text-muted">final {c.last4}, centro de custo no banco {c.bankCostCenter || "não informado"}</span>
                  <label className="visually-hidden" htmlFor={`link-${c.id}`}>Funcionário para o cartão final {c.last4}</label>
                  <select id={`link-${c.id}`} name="employeeId" className="input ml-auto w-56" required defaultValue="">
                    <option value="" disabled>vincular a…</option>
                    {assignable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="submit" className="btn-primary">vincular</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <nav aria-label="Situação" className="flex gap-1">
          {TABS.map((t) => (
            <Link key={t.value} href={`/admin/cadastro?situacao=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={situacao === t.value ? "page" : undefined}
              className={`flex min-h-10 items-center rounded-pill px-4 font-display text-sm lowercase ${situacao === t.value ? "bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-2"}`}>
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="ml-auto flex items-center gap-2" role="search">
          <input type="hidden" name="situacao" value={situacao} />
          <label className="visually-hidden" htmlFor="q">Buscar por nome, e-mail ou centro de custo</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="buscar…" className="input w-64" />
          <button type="submit" className="btn-ghost">buscar</button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr><th scope="col">nome</th><th scope="col">perfil</th><th scope="col">líder</th><th scope="col">centro de custo</th><th scope="col">cartões</th><th scope="col">situação</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-muted">Ninguém por aqui.</td></tr>}
            {rows.map((p) => {
              const own = realCards.filter((c) => c.employeeId === p.id);
              const leader = p.leaderId ? byId.get(p.leaderId) : null;
              return (
                <tr key={p.id}>
                  <td><Link href={`/admin/cadastro/${p.id}`} className="link text-link">{p.name}</Link><div className="text-sm text-muted">{p.email}</div></td>
                  <td>{ROLE_LABELS[p.role]}</td>
                  <td>{leader ? leader.name : <span className="text-muted">administrador</span>}</td>
                  <td>{p.costCenter || <span className="text-muted">não informado</span>}</td>
                  <td>{own.length ? own.map((c) => `final ${c.last4}`).join(", ") : <span className="text-muted">nenhum</span>}</td>
                  <td>{p.active ? "ativo" : <span className="text-muted">desligado em {date(p.terminatedAt)}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
