import { notFound } from "next/navigation";
import { CalendarDays, CreditCard, FileText, Paperclip, Tags, Wallet } from "lucide-react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { getExpense, listCategories, openReports } from "@/lib/expenses";
import { date, dateTime, money, titleCase } from "@/lib/format";
import { PAYMENT_LABELS, STATUS_LABELS } from "@/lib/status";
import { ExpenseForm } from "@/components/expense-form";
import { TopBar } from "@/components/mobile/top-bar";
import { saveExpenseAction } from "./actions";

const PAYMENT_TITLE: Record<string, string> = { cartao: "Cartão corporativo", dinheiro: "Dinheiro (reembolso)", adiantamento: "Adiantamento" };

export default async function ExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ voltar?: string }> }) {
  const { id } = await params;
  const { voltar } = await searchParams;
  const user = await requireUser();
  const db = await getDb();
  const at = await now(db);
  const row = await getExpense(db, Number(id));
  if (!row || row.owner?.id !== user.id || new Date(row.e.availableAt) > at) notFound();
  const { e, tx } = row;
  const back = voltar?.startsWith("/app") ? voltar : "/app/despesas";
  const editable = e.kind !== "estorno" && row.status !== "em_aprovacao" && row.status !== "aprovada";
  const waiting = row.status === "sem_relatorio" || row.status === "em_relatorio" || row.status === "ignorada";

  if (editable) {
    return (
      <ExpenseForm
        action={saveExpenseAction}
        mode="edit"
        back={back}
        expenseId={e.id}
        view={{
          amountLabel: money(e.amountCents),
          merchant: titleCase(e.merchant),
          date: date(e.purchaseDate),
          currency: tx?.originalCurrency && tx.originalCurrency !== "BRL" ? `${tx.originalCurrency} ${(tx.originalAmountMillis / 1000).toFixed(2)}` : "BRL",
          payment: { method: e.paymentMethod, label: PAYMENT_TITLE[e.paymentMethod], cardLast4: row.card?.last4 },
          deadline: waiting ? `${row.status === "ignorada" ? "venceu em" : "até"} ${dateTime(e.dueAt).slice(0, 10)}` : undefined,
          returnedComment: row.status === "devolvida" ? e.reviewComment : undefined,
          reportName: row.report?.name,
        }}
        categories={(await listCategories(db)).map((c) => ({ id: c.id, name: c.name, requiresReceipt: c.requiresReceipt }))}
        reports={(await openReports(db, user.id)).map((r) => ({ id: r.id, name: r.name }))}
        defaults={{ categoryId: e.categoryId ?? e.suggestedCategoryId, description: e.description, costCenter: e.savedAt ? e.costCenter : user.costCenter, reportId: e.reportId }}
        hasReceipt={!!e.receiptPath}
        lockReport={row.status === "devolvida"}
      />
    );
  }

  const rows: [typeof Tags, string, React.ReactNode][] = [
    [e.paymentMethod === "cartao" ? CreditCard : Wallet, "Pagamento", `${PAYMENT_LABELS[e.paymentMethod]}${row.card ? ` •••• ${row.card.last4}` : ""}`],
    [Tags, "Tipo da despesa", row.category?.name ?? "Sem tipo"],
    [CalendarDays, "Data", date(e.purchaseDate)],
    [FileText, "Relatório", row.report?.name ?? "Sem relatório"],
  ];
  return (
    <>
      <TopBar title={titleCase(e.merchant)} back={back}>
        <p className="figure mt-4 text-center text-4xl">{money(e.amountCents)}</p>
        <p className="mt-1 text-center text-sm opacity-80">{STATUS_LABELS[row.status].replace(/^./, (c) => c.toUpperCase())}</p>
      </TopBar>
      <section className="surface-card -mt-4 px-4 pb-4 pt-2">
        {rows.map(([Icon, label, value]) => (
          <div key={label} className="form-row">
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-ink" />
            <span className="shrink-0 text-ink">{label}</span>
            <span className="min-w-0 flex-1 truncate text-right text-muted">{value}</span>
          </div>
        ))}
        {e.kind === "estorno" ? (
          <p className="pt-4 text-sm text-muted">Estorno do estabelecimento. Não precisa de preenchimento.</p>
        ) : (
          <>
            {e.description && <p className="well mt-4 p-4 text-ink">{e.description}</p>}
            {e.receiptPath && (
              <a href={`/recibo/${e.id}`} target="_blank" className="btn-ghost mt-4 w-full normal-case">
                <Paperclip size={16} aria-hidden="true" /> Ver comprovante
              </a>
            )}
          </>
        )}
      </section>
    </>
  );
}
