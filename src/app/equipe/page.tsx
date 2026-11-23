import { Download } from "lucide-react";
import { getDb } from "@/db";
import { requireApprover } from "@/lib/auth";
import { now } from "@/lib/clock";
import { teamAlerts, teamOf } from "@/lib/people";
import { Dashboard } from "@/components/dashboard";
import { TeamAlerts } from "./alerts";

export default async function TeamDashboard({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await requireApprover();
  const db = await getDb();
  const [team, alerts] = await Promise.all([teamOf(db, user.id), teamAlerts(db, user.id, await now(db))]);
  const f = Number((await searchParams).f) || undefined;
  const ids = team.map((p) => p.id);

  if (!ids.length) {
    return (
      <>
        <h1 className="head text-3xl text-ink">minha equipe</h1>
        <p className="mt-3 max-w-xl text-ink-2">Você ainda não tem liderados. O administrador define a sua equipe no cadastro.</p>
      </>
    );
  }
  return (
    <>
      <TeamAlerts alerts={alerts} />
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        {/* Espaço reservado: exportação da equipe para estudo em Excel (ainda não disponível) */}
        <button type="button" className="btn-ghost" disabled aria-describedby="excel-nota"><Download size={16} aria-hidden="true" /> exportar para excel</button>
        <span id="excel-nota" className="text-sm text-muted">em breve</span>
      </div>
      <Dashboard
        ownerIds={ids}
        basePath="/equipe"
        selected={f}
        approvalsHref="/equipe/aprovacoes"
        noDataText={<p className="mt-3 text-ink-2">Quando a equipe tiver despesas, elas aparecem aqui.</p>}
      />
    </>
  );
}
