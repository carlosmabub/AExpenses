import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { getExpense, listCategories } from "@/lib/expenses";
import { date, installmentLabel, money, timeLeft, titleCase } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ClassifyForm } from "./classify-form";

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await getDb();
  const at = await now(db);
  const expense = await getExpense(db, Number(id));
  if (!expense || expense.card.employeeId !== user.id || new Date(expense.tx.availableAt) > at) notFound();
  const { tx, classification } = expense;
  const parcel = installmentLabel(tx.installment, tx.installmentsTotal);
  const facts: [string, string][] = [
    ["data da compra", date(tx.purchaseDate)],
    ["cartão", `final ${expense.card.last4}`],
    ["cidade", `${titleCase(tx.city)}${tx.state ? `/${tx.state}` : ""}`],
    ["ramo", titleCase(tx.activityDescription) || "não informado"],
  ];
  if (parcel) facts.push(["parcelamento", parcel]);
  if (tx.originalCurrency && tx.originalCurrency !== "BRL") facts.push(["valor original", `${(tx.originalAmountMillis / 1000).toFixed(2)} ${tx.originalCurrency}`]);

  return (
    <>
      <Link href="/app/despesas" className="link mt-4 inline-flex min-h-11 items-center gap-1 font-display text-sm lowercase text-muted">
        <ChevronLeft size={16} aria-hidden="true" /> despesas
      </Link>

      <h1 className="text-xl font-medium text-ink">{titleCase(tx.merchant)}</h1>
      <p className="figure mt-2 text-5xl text-ink">{money(tx.amountCents)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <StatusBadge status={expense.status} />
        {expense.status === "pendente" && <span>{timeLeft(tx.dueAt, at)}</span>}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-rule py-4 text-sm">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="label">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
        {tx.kind === "saque" && <dd className="col-span-2 text-ink-2">Saque em dinheiro: informe para que foi usado.</dd>}
      </dl>

      {tx.kind === "estorno" ? (
        <p className="mt-6 text-sm text-muted">Estorno do estabelecimento. Não precisa de classificação.</p>
      ) : (
        <section className="mt-8" aria-labelledby="classificar">
          <h2 id="classificar" className="head mb-5 text-xl text-ink">{classification ? "editar classificação" : "classificar despesa"}</h2>
          {classification?.inheritedFromId && (
            <p className="well mb-5 p-3 text-sm text-ink-2">Classificação copiada da parcela anterior desta compra.</p>
          )}
          <ClassifyForm
            transactionId={tx.id}
            categories={await listCategories(db)}
            defaultCategoryId={classification?.categoryId ?? expense.suggestedCategoryId}
            defaultDescription={classification?.description ?? ""}
            defaultCostCenter={classification?.costCenter ?? user.costCenter}
            hasReceipt={!!classification?.receiptPath}
          />
        </section>
      )}
    </>
  );
}
