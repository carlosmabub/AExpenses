import Link from "next/link";
import { Dashboard } from "@/components/dashboard";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const f = Number((await searchParams).f) || undefined;
  return (
    <Dashboard
      basePath="/admin"
      selected={f}
      adminLinks
      approvalsHref="/admin/aprovacoes"
      showImports
      noDataText={
        <>
          <p className="mt-3 text-ink-2">Importe o arquivo de cartões do Bradesco para as compras chegarem aos funcionários.</p>
          <Link href="/admin/importar" className="btn-primary mt-6">importar arquivo</Link>
        </>
      }
    />
  );
}
