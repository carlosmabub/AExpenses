import Link from "next/link";
import { notFound } from "next/navigation";
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
  const db = getDb();
  const at = now(db);
  const expense = getExpense(db, Number(id));
  if (!expense || expense.card.employeeId !== user.id || new Date(expense.tx.availableAt) > at) notFound();
  const { tx, classification } = expense;
  const parcel = installmentLabel(tx.installment, tx.installmentsTotal);

  return (
    <>
      <header className="bg-brand-600 px-4 pb-6 pt-4 text-white">
        <Link href="/app/despesas" className="text-sm text-brand-100">← Voltar</Link>
        <p className="mt-3 text-sm text-brand-100">{titleCase(tx.merchant)}</p>
        <p className="text-3xl font-bold">{money(tx.amountCents)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-brand-100">
          <StatusBadge status={expense.status} />
          {expense.status === "pendente" && <span>{timeLeft(tx.dueAt, at)}</span>}
        </div>
      </header>

      <section className="space-y-4 p-4">
        <dl className="card grid grid-cols-2 gap-3 p-4 text-sm">
          <div><dt className="text-xs text-slate-500">Data da compra</dt><dd className="font-medium">{date(tx.purchaseDate)}</dd></div>
          <div><dt className="text-xs text-slate-500">Cartão</dt><dd className="font-medium">final {expense.card.last4}</dd></div>
          <div><dt className="text-xs text-slate-500">Cidade</dt><dd className="font-medium">{titleCase(tx.city)}{tx.state ? `/${tx.state}` : ""}</dd></div>
          <div><dt className="text-xs text-slate-500">Ramo</dt><dd className="font-medium">{titleCase(tx.activityDescription) || "—"}</dd></div>
          {parcel && <div><dt className="text-xs text-slate-500">Parcelamento</dt><dd className="font-medium">{parcel}</dd></div>}
          {tx.originalCurrency && tx.originalCurrency !== "BRL" && (
            <div><dt className="text-xs text-slate-500">Valor original</dt><dd className="font-medium">{(tx.originalAmountMillis / 1000).toFixed(2)} {tx.originalCurrency}</dd></div>
          )}
          {tx.kind === "saque" && <div className="col-span-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Saque em dinheiro: informe para que foi usado.</div>}
        </dl>

        {tx.kind === "estorno" ? (
          <p className="card p-4 text-sm text-slate-600">Estorno do estabelecimento. Não precisa de classificação.</p>
        ) : (
          <div className="card p-4">
            <h2 className="mb-4 font-semibold text-slate-800">{classification ? "Editar classificação" : "Classificar despesa"}</h2>
            {classification?.inheritedFromId && (
              <p className="mb-3 rounded-lg bg-brand-50 p-2 text-xs text-brand-700">Classificação copiada da parcela anterior desta compra.</p>
            )}
            <ClassifyForm
              transactionId={tx.id}
              categories={listCategories(db)}
              defaultCategoryId={classification?.categoryId ?? expense.suggestedCategoryId}
              defaultDescription={classification?.description ?? ""}
              defaultCostCenter={classification?.costCenter ?? user.costCenter}
              hasReceipt={!!classification?.receiptPath}
            />
          </div>
        )}
      </section>
    </>
  );
}
