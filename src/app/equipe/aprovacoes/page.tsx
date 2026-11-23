import { getDb } from "@/db";
import { requireApprover } from "@/lib/auth";
import { now } from "@/lib/clock";
import { teamAlerts } from "@/lib/people";
import { listReportsForApproval } from "@/lib/reports";
import { PageTitle } from "@/components/page-title";
import { ApprovalsList } from "@/components/approvals-list";
import { TeamAlerts } from "../alerts";

export default async function TeamApprovals({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requireApprover();
  const db = await getDb();
  const [reports, alerts] = await Promise.all([listReportsForApproval(db, user), teamAlerts(db, user.id, await now(db))]);
  return (
    <>
      <TeamAlerts alerts={alerts} />
      <PageTitle title="aprovações" subtitle="Relatórios enviados pela sua equipe." />
      <ApprovalsList reports={reports} basePath="/equipe/aprovacoes" showDone={(await searchParams).aba === "aprovados"} />
    </>
  );
}
