import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { getDb } from "@/db";
import { getExpense } from "@/lib/expenses";
import { TRANSACTION_CODE_LABELS } from "@/lib/bvk3/codes";
import { date, dateTime, installmentLabel, money, titleCase } from "@/lib/format";
import { classifiedLate } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { CategoryIcon } from "@/components/category-icon";

export default async function AdminExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const r = await getExpense(await getDb(), Number((await params).id));
  if (!r) notFound();
  const { tx, classification: c } = r;
  const fields: [string, string][] = [
    ["funcionário", r.employee?.name ?? `${r.card.holderName} (cartão não vinculado)`],
    ["cartão", `final ${r.card.last4}`],
    ["data da compra", date(tx.purchaseDate)],
    ["data do lançamento", date(tx.postingDate)],
    ["chegou no app", dateTime(tx.availableAt)],
    ["prazo para classificar", dateTime(tx.dueAt)],
    ["tipo", TRANSACTION_CODE_LABELS[tx.transactionCode] ?? tx.transactionCode],
    ["parcela", installmentLabel(tx.installment, tx.installmentsTotal) ?? "à vista"],
    ["cidade", `${titleCase(tx.city)}${tx.state ? `/${tx.state}` : ""}`],
    ["CNPJ do estabelecimento", tx.merchantCnpj || "não informado"],
    ["ramo (MCC)", `${tx.mcc}, ${titleCase(tx.activityDescription)}`],
    ["moeda original", `${tx.originalCurrency} ${(tx.originalAmountMillis / 1000).toFixed(2)}`],
    ["autorização", tx.authorizationCode || "não informada"],
    ["referência Visa", tx.reference],
  ];

  return (
    <div className="max-w-5xl">
      <Link href="/admin/transacoes" className="link inline-flex min-h-10 items-center gap-1 font-display text-sm lowercase text-muted">
        <ChevronLeft size={16} aria-hidden="true" /> despesas
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink">{titleCase(tx.merchant)}</h1>
          <p className="figure mt-2 text-5xl text-ink">{money(tx.amountCents)}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="mt-10 grid gap-12 md:grid-cols-2">
        <section aria-labelledby="dados">
          <h2 id="dados" className="head text-xl text-ink">dados do banco</h2>
          <dl className="mt-3 border-t border-rule text-sm">
            {fields.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-rule py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right tabular-nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="justificativa">
          <h2 id="justificativa" className="head text-xl text-ink">justificativa do funcionário</h2>
          {c ? (
            <dl className="mt-3 space-y-3 border-t border-rule pt-3 text-sm">
              <div><dt className="label">categoria</dt><dd className="flex items-center gap-2 text-ink"><CategoryIcon name={r.category?.icon} size={16} className="text-muted" />{r.category?.name}</dd></div>
              <div><dt className="label">descrição</dt><dd className="text-ink">{c.description}</dd></div>
              <div><dt className="label">centro de custo</dt><dd className="text-ink">{c.costCenter || "não informado"}</dd></div>
              <div>
                <dt className="label">classificada em</dt>
                <dd className="text-ink">
                  {dateTime(c.classifiedAt)}
                  {classifiedLate({ kind: tx.kind, dueAt: tx.dueAt, classifiedAt: c.classifiedAt }) && <span className="text-error">, fora do prazo</span>}
                </dd>
              </div>
              {c.inheritedFromId && <dd className="text-ink-2">Herdada de outra parcela da mesma compra.</dd>}
              <div>
                <dt className="label">comprovante</dt>
                <dd>
                  {c.receiptPath ? (
                    c.receiptMime?.startsWith("image/") ? (
                      <a href={`/recibo/${tx.id}`} target="_blank" className="block">
                        <img src={`/recibo/${tx.id}`} alt={`Comprovante de ${titleCase(tx.merchant)}`} className="max-h-96 rounded-card outline outline-1 -outline-offset-1 outline-rule" />
                      </a>
                    ) : (
                      <a href={`/recibo/${tx.id}`} target="_blank" className="btn-ghost"><FileText size={16} aria-hidden="true" /> abrir comprovante</a>
                    )
                  ) : (
                    <span className="text-muted">Sem comprovante anexado.</span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className={`mt-3 border-t border-rule pt-3 text-sm ${r.status === "ignorada" ? "text-error" : "text-muted"}`}>
              {r.status === "ignorada" ? "O funcionário não classificou no prazo." : "Aguardando o funcionário."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
