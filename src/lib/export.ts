import * as XLSX from "xlsx";
import type { ExpenseRow } from "./expenses";
import { PAYMENT_LABELS, REPORT_STAGE_LABELS, STATUS_LABELS } from "./status";

/** Planilha da prestação de contas para carga no ERP: tudo, com o status de aprovação. */
export function expensesWorkbook(rows: ExpenseRow[]): Buffer {
  const data = rows.map((r) => ({
    "Funcionário": r.owner?.name ?? `${r.card?.holderName ?? ""} (não vinculado)`,
    "Centro de custo": r.e.costCenter || r.owner?.costCenter || "",
    "Forma de pagamento": PAYMENT_LABELS[r.e.paymentMethod],
    "Cartão (final)": r.card?.last4 ?? "",
    "Data da compra": r.e.purchaseDate ?? "",
    "Data do lançamento": r.tx?.postingDate ?? "",
    "Estabelecimento": r.e.merchant,
    "CNPJ do estabelecimento": r.tx?.merchantCnpj ?? "",
    "Cidade": r.e.city,
    "UF": r.tx?.state ?? "",
    "MCC": r.tx?.mcc ?? "",
    "Ramo": r.tx?.activityDescription ?? "",
    "Parcela": r.tx && r.tx.installmentsTotal > 1 ? `${r.tx.installment}/${r.tx.installmentsTotal}` : "",
    "Tipo de lançamento": r.e.kind,
    "Valor (R$)": (r.e.kind === "estorno" ? -1 : 1) * (r.e.amountCents / 100),
    "Tipo da despesa": r.category?.name ?? "",
    "Descrição": r.e.description,
    "Comprovante": r.e.receiptPath ? "sim" : "não",
    "Relatório": r.report?.name ?? "",
    "Status": STATUS_LABELS[r.status],
    "Aprovação": r.e.reviewStatus ?? (r.report && r.report.status !== "aberto" ? REPORT_STAGE_LABELS.em_aprovacao : ""),
    "Comentário do aprovador": r.e.reviewComment,
    "Referência Visa": r.tx?.reference ?? "",
    "Autorização": r.tx?.authorizationCode ?? "",
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  sheet["!cols"] = Object.keys(data[0] ?? { a: 1 }).map((k) => ({ wch: Math.max(12, k.length + 2) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Despesas");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
