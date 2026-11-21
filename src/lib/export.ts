import * as XLSX from "xlsx";
import type { ExpenseRow } from "./expenses";
import { STATUS_LABELS } from "./status";

/** Planilha de prestação de contas para carga no ERP. */
export function expensesWorkbook(rows: ExpenseRow[]): Buffer {
  const data = rows.map((r) => ({
    "Funcionário": r.employee?.name ?? `${r.card.holderName} (não vinculado)`,
    "Centro de custo": r.classification?.costCenter || r.employee?.costCenter || "",
    "Cartão (final)": r.card.last4,
    "Data da compra": r.tx.purchaseDate ?? "",
    "Data do lançamento": r.tx.postingDate ?? "",
    "Estabelecimento": r.tx.merchant,
    "CNPJ do estabelecimento": r.tx.merchantCnpj,
    "Cidade": r.tx.city,
    "UF": r.tx.state,
    "MCC": r.tx.mcc,
    "Ramo": r.tx.activityDescription,
    "Parcela": r.tx.installmentsTotal > 1 ? `${r.tx.installment}/${r.tx.installmentsTotal}` : "",
    "Tipo": r.tx.kind,
    "Valor (R$)": (r.tx.kind === "estorno" ? -1 : 1) * (r.tx.amountCents / 100),
    "Categoria": r.category?.name ?? "",
    "Descrição": r.classification?.description ?? "",
    "Comprovante": r.classification?.receiptPath ? "sim" : "não",
    "Status": STATUS_LABELS[r.status],
    "Classificada em": r.classification?.classifiedAt ?? "",
    "Referência Visa": r.tx.reference,
    "Autorização": r.tx.authorizationCode,
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  sheet["!cols"] = Object.keys(data[0] ?? { a: 1 }).map((k) => ({ wch: Math.max(12, k.length + 2) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Despesas");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
