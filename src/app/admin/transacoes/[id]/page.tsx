import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getExpense } from "@/lib/expenses";
import { TRANSACTION_CODE_LABELS } from "@/lib/bvk3/codes";
import { date, dateTime, installmentLabel, money, titleCase } from "@/lib/format";
import { classifiedLate } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";

export default async function AdminExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const r = await getExpense(await getDb(), Number((await params).id));
  if (!r) notFound();
  const { tx, classification: c } = r;
  const fields: [string, string][] = [
    ["Funcionário", r.employee?.name ?? `${r.card.holderName} (cartão não vinculado)`],
    ["Cartão", `final ${r.card.last4}`],
    ["Data da compra", date(tx.purchaseDate)],
    ["Data do lançamento", date(tx.postingDate)],
    ["Chegou no app", dateTime(tx.availableAt)],
    ["Prazo para classificar", dateTime(tx.dueAt)],
    ["Tipo", TRANSACTION_CODE_LABELS[tx.transactionCode] ?? tx.transactionCode],
    ["Parcela", installmentLabel(tx.installment, tx.installmentsTotal) ?? "À vista"],
    ["Cidade", `${titleCase(tx.city)}${tx.state ? `/${tx.state}` : ""}`],
    ["CNPJ do estabelecimento", tx.merchantCnpj || "—"],
    ["Ramo (MCC)", `${tx.mcc} · ${titleCase(tx.activityDescription)}`],
    ["Moeda original", `${tx.originalCurrency} ${(tx.originalAmountMillis / 1000).toFixed(2)}`],
    ["Autorização", tx.authorizationCode || "—"],
    ["Referência Visa", tx.reference],
  ];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/transacoes" className="text-sm text-slate-500">← Despesas</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{titleCase(tx.merchant)}</h1>
          <p className="text-3xl font-bold text-brand-600">{money(tx.amountCents)}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <dl className="card divide-y divide-slate-100 text-sm">
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-5 py-2.5"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
        <div className="card p-5">
          <h2 className="font-semibold">Justificativa do funcionário</h2>
          {c ? (
            <div className="mt-3 space-y-2 text-sm">
              <p><span className="text-slate-500">Categoria:</span> {r.category?.icon} {r.category?.name}</p>
              <p><span className="text-slate-500">Descrição:</span> {c.description}</p>
              <p><span className="text-slate-500">Centro de custo:</span> {c.costCenter || "—"}</p>
              <p><span className="text-slate-500">Classificada em:</span> {dateTime(c.classifiedAt)}{classifiedLate({ kind: tx.kind, dueAt: tx.dueAt, classifiedAt: c.classifiedAt }) ? " (fora do prazo)" : ""}</p>
              {c.inheritedFromId && <p className="text-xs text-brand-700">Herdada de outra parcela da mesma compra.</p>}
              {c.receiptPath ? (
                c.receiptMime?.startsWith("image/") ? (
                  <a href={`/recibo/${tx.id}`} target="_blank"><img src={`/recibo/${tx.id}`} alt="Comprovante" className="mt-2 max-h-96 rounded-lg ring-1 ring-slate-200" /></a>
                ) : (
                  <a href={`/recibo/${tx.id}`} target="_blank" className="btn-ghost mt-2">📎 Abrir comprovante</a>
                )
              ) : (
                <p className="text-slate-400">Sem comprovante anexado.</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{r.status === "ignorada" ? "⚠️ O funcionário não classificou no prazo." : "Aguardando o funcionário."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
