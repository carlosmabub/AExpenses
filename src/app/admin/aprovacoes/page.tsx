import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { listReportsForApproval } from "@/lib/reports";
import { PageTitle } from "@/components/page-title";
import { ApprovalsList } from "@/components/approvals-list";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const admin = await requireAdmin();
  const reports = await listReportsForApproval(await getDb(), admin);
  return (
    <>
      <PageTitle title="aprovações" subtitle="Relatórios enviados pelos funcionários." />
      <ApprovalsList reports={reports} basePath="/admin/aprovacoes" showDone={(await searchParams).aba === "aprovados"} />
    </>
  );
}
