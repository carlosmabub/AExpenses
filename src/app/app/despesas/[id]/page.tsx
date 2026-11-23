import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CreditCard, Wallet } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { getExpense, listCategories, openReports } from "@/lib/expenses";
import { date, installmentLabel, money, timeLeft, titleCase } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { ExpenseForm } from "@/components/expense-form";
import { saveExpenseAction } from "./actions";

export default async function ExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ voltar?: string }> }) {
  const { id } = await params;
  const { voltar } = await searchParams;
  const user = await requireUser();
  const db = await getDb();
  const at = await now(db);
  const row = await getExpense(db, Number(id));
  if (!row || row.owner?.id !== user.id || new Date(row.e.availableAt) > at) notFound();
  const { e, tx } = row;
  const parcel = tx ? installmentLabel(tx.installment, tx.installmentsTotal) : null;
  const editable = e.kind !== "estorno" && row.status !== "em_aprovacao" && row.status !== "aprovada";
  const facts: [string, string][] = [
    ["data", date(e.purchaseDate)],
    ["cidade", e.city ? titleCase(e.city) : "não informada"],
  ];
  if (tx) facts.push(["ramo", titleCase(tx.activityDescription) || "não informado"]);
  if (parcel) facts.push(["parcelamento", parcel]);
  if (tx && tx.originalCurrency && tx.originalCurrency !== "BRL") facts.push(["valor original", `${(tx.originalAmountMillis / 1000).toFixed(2)} ${tx.originalCurrency}`]);
  const back = voltar?.startsWith("/app/") ? voltar : "/app/despesas";

  return (
    <>
      <Link href={back} className="link mt-4 inline-flex min-h-11 items-center gap-1 font-display text-sm lowercase text-muted">
        <ChevronLeft size={16} aria-hidden="true" /> voltar
      </Link>

      <h1 className="text-xl font-medium text-ink">{titleCase(e.merchant)}</h1>
      <p className="figure mt-2 text-5xl text-ink">{money(e.amountCents)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <StatusBadge status={row.status} />
        {(row.status === "sem_relatorio" || row.status === "em_relatorio") && <span>{timeLeft(e.dueAt, at)}</span>}
      </div>

      {row.status === "devolvida" && (
        <div role="status" className="mt-5 rounded-card p-4 text-sm shadow-[inset_0_0_0_1.5px_var(--color-error)]">
          <p className="font-medium text-error">Devolvida pelo aprovador</p>
          <p className="mt-1 text-ink">{e.reviewComment}</p>
          <p className="mt-1 text-muted">Corrija e salve: ela volta para aprovação no relatório {row.report?.name}.</p>
        </div>
      )}

      <section className="well mt-6 flex items-center gap-3 p-4" aria-label="Pagamento feito com">
        {e.paymentMethod === "cartao" ? <CreditCard size={22} aria-hidden="true" className="text-ink" /> : <Wallet size={22} aria-hidden="true" className="text-ink" />}
        <div>
          <p className="label mb-0">pagamento feito com</p>
          <p className="text-ink">
            {PAYMENT_LABELS[e.paymentMethod]}
            {row.card ? `, final ${row.card.last4}` : ""}
          </p>
        </div>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-rule pb-4 text-sm">
        {facts.map(([k, v]) => (
          <div key={k}><dt className="label">{k}</dt><dd className="text-ink">{v}</dd></div>
        ))}
        {e.kind === "saque" && <dd className="col-span-2 text-ink-2">Saque em dinheiro: informe para que foi usado.</dd>}
      </dl>

      {e.kind === "estorno" ? (
        <p className="mt-6 text-sm text-muted">Estorno do estabelecimento. Não precisa de preenchimento.</p>
      ) : editable ? (
        <section className="mt-8" aria-labelledby="preencher">
          <h2 id="preencher" className="head mb-5 text-xl text-ink">{e.savedAt ? "editar despesa" : "preencher despesa"}</h2>
          {e.inheritedFromId && <p className="well mb-5 p-3 text-sm text-ink-2">Preenchimento copiado da parcela anterior desta compra.</p>}
          <ExpenseForm
            action={saveExpenseAction}
            mode="edit"
            expenseId={e.id}
            categories={(await listCategories(db)).map((c) => ({ id: c.id, name: c.name, requiresReceipt: c.requiresReceipt }))}
            reports={(await openReports(db, user.id)).map((r) => ({ id: r.id, name: r.name }))}
            defaults={{ categoryId: e.categoryId ?? e.suggestedCategoryId, description: e.description, costCenter: e.savedAt ? e.costCenter : user.costCenter, reportId: e.reportId }}
            hasReceipt={!!e.receiptPath}
            lockReport={row.status === "devolvida"}
            back={back}
          />
        </section>
      ) : (
        <section className="mt-8" aria-labelledby="enviada">
          <h2 id="enviada" className="head text-xl text-ink">{row.status === "aprovada" ? "aprovada" : "com o aprovador"}</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div><dt className="label">tipo</dt><dd>{row.category?.name}</dd></div>
            <div><dt className="label">descrição</dt><dd>{e.description}</dd></div>
            <div><dt className="label">centro de custo</dt><dd>{e.costCenter || "não informado"}</dd></div>
            <div><dt className="label">relatório</dt><dd><Link className="link text-link" href={`/app/relatorios/${row.report?.id}`}>{row.report?.name}</Link></dd></div>
            {e.receiptPath && <div><dt className="label">comprovante</dt><dd><a className="link text-link" href={`/recibo/${e.id}`} target="_blank">abrir comprovante</a></dd></div>}
          </dl>
        </section>
      )}
    </>
  );
}
