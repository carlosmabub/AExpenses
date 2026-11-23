import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { getDb } from "@/db";
import { getExpense } from "@/lib/expenses";
import { TRANSACTION_CODE_LABELS } from "@/lib/bvk3/codes";
import { date, dateTime, installmentLabel, money, titleCase } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { CategoryIcon } from "@/components/category-icon";

export default async function AdminExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const r = await getExpense(await getDb(), Number((await params).id));
  if (!r) notFound();
  const { e, tx } = r;
  const fields: [string, string][] = [
    ["funcionário", r.owner?.name ?? `${r.card?.holderName} (cartão não vinculado)`],
    ["pagamento", `${PAYMENT_LABELS[e.paymentMethod]}${r.card ? `, final ${r.card.last4}` : ""}`],
    ["data da compra", date(e.purchaseDate)],
    ["chegou no app", dateTime(e.availableAt)],
    ["prazo para relatório", dateTime(e.dueAt)],
  ];
  if (tx) {
    fields.push(
      ["data do lançamento", date(tx.postingDate)],
      ["tipo de lançamento", TRANSACTION_CODE_LABELS[tx.transactionCode] ?? tx.transactionCode],
      ["parcela", installmentLabel(tx.installment, tx.installmentsTotal) ?? "à vista"],
      ["cidade", `${titleCase(tx.city)}${tx.state ? `/${tx.state}` : ""}`],
      ["CNPJ do estabelecimento", tx.merchantCnpj || "não informado"],
      ["ramo (MCC)", `${tx.mcc}, ${titleCase(tx.activityDescription)}`],
      ["moeda original", `${tx.originalCurrency} ${(tx.originalAmountMillis / 1000).toFixed(2)}`],
      ["autorização", tx.authorizationCode || "não informada"],
      ["referência Visa", tx.reference],
    );
  }

  return (
    <div className="max-w-5xl">
      <Link href="/admin/transacoes" className="link inline-flex min-h-10 items-center gap-1 font-display text-sm lowercase text-muted">
        <ChevronLeft size={16} aria-hidden="true" /> despesas
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink">{titleCase(e.merchant)}</h1>
          <p className="figure mt-2 text-5xl text-ink">{money(e.amountCents)}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="mt-10 grid gap-12 md:grid-cols-2">
        <section aria-labelledby="dados">
          <h2 id="dados" className="head text-xl text-ink">{tx ? "dados do banco" : "despesa manual"}</h2>
          <dl className="mt-3 border-t border-rule text-sm">
            {fields.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-rule py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right tabular-nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="preenchimento">
          <h2 id="preenchimento" className="head text-xl text-ink">preenchido pelo funcionário</h2>
          {e.savedAt ? (
            <dl className="mt-3 space-y-3 border-t border-rule pt-3 text-sm">
              <div><dt className="label">tipo</dt><dd className="flex items-center gap-2 text-ink"><CategoryIcon name={r.category?.icon} size={16} className="text-muted" />{r.category?.name}</dd></div>
              <div><dt className="label">descrição</dt><dd className="text-ink">{e.description}</dd></div>
              <div><dt className="label">centro de custo</dt><dd className="text-ink">{e.costCenter || "não informado"}</dd></div>
              <div><dt className="label">relatório</dt><dd className="text-ink">{r.report ? (r.report.status === "aberto" ? `${r.report.name} (aberto)` : <Link className="link text-link" href={`/admin/aprovacoes/${r.report.id}`}>{r.report.name}</Link>) : "sem relatório"}</dd></div>
              <div><dt className="label">salva em</dt><dd className="text-ink">{dateTime(e.savedAt)}</dd></div>
              {e.inheritedFromId && <dd className="text-ink-2">Copiada de outra parcela da mesma compra.</dd>}
              {e.reviewStatus && (
                <div>
                  <dt className="label">aprovação</dt>
                  <dd className={e.reviewStatus === "devolvida" ? "text-error" : "text-ink"}>
                    {e.reviewStatus}{e.reviewedAt ? ` em ${dateTime(e.reviewedAt)}` : ""}{e.reviewComment ? `: ${e.reviewComment}` : ""}
                  </dd>
                </div>
              )}
              <div>
                <dt className="label">comprovante</dt>
                <dd>
                  {e.receiptPath ? (
                    e.receiptMime?.startsWith("image/") ? (
                      <a href={`/recibo/${e.id}`} target="_blank" className="block">
                        <img src={`/recibo/${e.id}`} alt={`Comprovante de ${titleCase(e.merchant)}`} className="max-h-96 rounded-card outline outline-1 -outline-offset-1 outline-rule" />
                      </a>
                    ) : (
                      <a href={`/recibo/${e.id}`} target="_blank" className="btn-ghost"><FileText size={16} aria-hidden="true" /> abrir comprovante</a>
                    )
                  ) : (
                    <span className="text-muted">Sem comprovante anexado.</span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className={`mt-3 border-t border-rule pt-3 text-sm ${r.status === "ignorada" ? "text-error" : "text-muted"}`}>
              {r.status === "ignorada" ? "O prazo venceu e a despesa não entrou num relatório enviado." : "Aguardando o funcionário."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
