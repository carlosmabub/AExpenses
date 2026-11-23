"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CreditCard, FileText, Pencil, ReceiptText, Tags, Upload, Wallet, X } from "lucide-react";
import type { FormState } from "@/app/app/despesas/[id]/actions";

interface Option {
  id: number;
  name: string;
}

export interface ExpenseView {
  amountLabel: string;
  merchant: string;
  date: string;
  currency: string;
  payment: { method: "cartao" | "dinheiro" | "adiantamento"; label: string; cardLast4?: string };
  /** Texto do prazo, ex.: "até 31/10/2026" */
  deadline?: string;
  /** Comentário do aprovador quando a despesa foi devolvida */
  returnedComment?: string;
  reportName?: string;
}

interface Props {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  mode: "edit" | "new";
  back: string;
  expenseId?: number;
  view?: ExpenseView;
  categories: (Option & { requiresReceipt: boolean })[];
  reports: Option[];
  defaults: { categoryId: number | null; description: string; costCenter: string; reportId: number | null; purchaseDate?: string };
  hasReceipt: boolean;
  /** Despesa devolvida: fica no relatório dela */
  lockReport?: boolean;
}

function Row({ icon: Icon, label, htmlFor, children }: { icon: typeof Pencil; label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="form-row">
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-ink" />
      <label htmlFor={htmlFor} className="shrink-0 text-ink">{label}</label>
      {children}
    </div>
  );
}

/** Seleção como no modelo validado: "Selecione >" à direita, abrindo a lista do celular. */
function SelectRow({ icon, label, id, name, value, onChange, defaultValue, placeholder, options, required }: {
  icon: typeof Pencil;
  label: string;
  id: string;
  name: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  placeholder: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <Row icon={icon} label={label} htmlFor={id}>
      <span className="relative flex min-w-0 flex-1 items-center justify-end gap-1 text-link">
        <select
          id={id}
          name={name}
          required={required}
          {...(onChange ? { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) } : { defaultValue })}
          className="row-control appearance-none truncate pr-0 [text-align-last:right]"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
      </span>
    </Row>
  );
}

export function ExpenseForm(props: Props) {
  const [state, action, pending] = useActionState(props.action, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<FormState>(null);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>(props.defaults.categoryId ? String(props.defaults.categoryId) : "");
  const category = props.categories.find((c) => String(c.id) === categoryId);
  const isNew = props.mode === "new";
  const showPolicy = state?.policy && state !== dismissed;
  const formId = "expense-form";

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        // Sem o reset automático do React: se o salvar falhar, o que foi digitado fica
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {props.expenseId && <input type="hidden" name="expenseId" value={props.expenseId} />}
      <input type="hidden" name="back" value={props.back} />

      <header className="-mx-4 bg-ink px-4 pb-8 pt-3 text-accent-ink">
        <div className="flex min-h-12 items-center gap-2">
          <Link href={props.back} aria-label="Voltar" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-pill hover:bg-white/10">
            <ChevronLeft size={24} aria-hidden="true" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center font-display text-lg font-medium">{isNew ? "Nova despesa" : props.view?.merchant}</h1>
          <button type="submit" aria-label="Salvar" disabled={pending} className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-pill hover:bg-white/10">
            <Check size={24} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center">
          <label htmlFor="receipt" className="relative flex h-28 w-28 cursor-pointer items-center justify-center rounded-pill bg-surface text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-white">
            {preview ? (
              <img src={preview} alt="Prévia do comprovante" className="h-full w-full rounded-pill object-cover" />
            ) : (
              <ReceiptText size={44} strokeWidth={1.5} aria-hidden="true" />
            )}
            <span className="absolute bottom-1 right-1 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-accent-ink ring-2 ring-surface">
              {props.hasReceipt || preview ? <Check size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            </span>
            <span className="visually-hidden">{props.hasReceipt ? "Trocar a foto do comprovante" : "Anexar a foto do comprovante"}</span>
            <input
              id="receipt"
              type="file"
              name="receipt"
              accept="image/*,application/pdf"
              capture="environment"
              className="visually-hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFileName(f ? f.name : null);
                setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
              }}
            />
          </label>
          <p className="mt-2 text-xs opacity-80">
            {fileName ?? (props.hasReceipt ? "Comprovante anexado" : category && !category.requiresReceipt ? "Comprovante opcional" : "Toque para anexar o comprovante")}
          </p>
          {isNew ? (
            <label htmlFor="amount" className="figure mt-3 flex items-baseline justify-center gap-2 px-2 text-4xl">
              <span aria-hidden="true">R$</span>
              <span className="visually-hidden">Valor em reais</span>
              <input
                id="amount"
                name="amount"
                inputMode="decimal"
                required
                placeholder="0,00"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                style={{ width: `${Math.max(4, amount.length)}ch` }}
                className="border-b-2 border-white/25 bg-transparent text-left text-accent-ink outline-none placeholder:text-white/50 focus-visible:border-white"
              />
            </label>
          ) : (
            <>
              <p className="figure mt-3 text-4xl">{props.view?.amountLabel}</p>
              {props.view?.currency && props.view.currency !== "BRL" && <p className="mt-1 text-sm opacity-80">valor original {props.view.currency}</p>}
            </>
          )}
        </div>
      </header>

      <section className="surface-card -mt-4 px-4 pb-4 pt-4">
        {props.view?.returnedComment && (
          <div role="status" className="mb-3 border-b border-rule pb-3 text-sm">
            <p className="font-medium text-error">Devolvida pelo aprovador</p>
            <p className="mt-1 text-ink">{props.view.returnedComment}</p>
            <p className="mt-1 text-muted">Corrija e salve: ela volta para aprovação no relatório {props.view.reportName}.</p>
          </div>
        )}

        {isNew ? (
          <SelectRow
            icon={Wallet}
            label="Forma de pagamento"
            id="paymentMethod"
            name="paymentMethod"
            defaultValue="dinheiro"
            placeholder="Selecione"
            required
            options={[{ value: "dinheiro", label: "Dinheiro (reembolso)" }, { value: "adiantamento", label: "Adiantamento" }]}
          />
        ) : (
          props.view && (
            <div className="mb-2">
              <p className="text-sm text-muted">Pagamento feito com</p>
              <div className="well mt-2 flex items-center gap-3 p-3">
                {props.view.payment.method === "cartao" ? <CreditCard size={22} aria-hidden="true" /> : <Wallet size={22} aria-hidden="true" />}
                <span className="flex-1 text-ink">{props.view.payment.label}</span>
                {props.view.payment.cardLast4 && <span className="tabular-nums text-muted">•••• {props.view.payment.cardLast4}</span>}
              </div>
            </div>
          )
        )}

        {!isNew && (
          <Row icon={Pencil} label={props.view?.merchant ?? ""}>
            <span />
          </Row>
        )}

        <SelectRow
          icon={Tags}
          label="Tipo da despesa"
          id="categoryId"
          name="categoryId"
          value={categoryId}
          onChange={setCategoryId}
          placeholder="Selecione"
          required
          options={props.categories.map((c) => ({ value: String(c.id), label: c.name }))}
        />

        {isNew ? (
          <Row icon={CalendarDays} label="Data" htmlFor="purchaseDate">
            <input id="purchaseDate" name="purchaseDate" type="date" required defaultValue={props.defaults.purchaseDate} max={props.defaults.purchaseDate} className="row-control" />
          </Row>
        ) : (
          <Row icon={CalendarDays} label="Data">
            <span className="flex-1 text-right text-muted tabular-nums">{props.view?.date}</span>
          </Row>
        )}

        {props.lockReport ? (
          <Row icon={FileText} label="Relatório">
            <span className="flex-1 truncate text-right text-muted">{props.view?.reportName}</span>
          </Row>
        ) : (
          <SelectRow
            icon={FileText}
            label="Relatório"
            id="reportId"
            name="reportId"
            defaultValue={props.defaults.reportId ? String(props.defaults.reportId) : ""}
            placeholder="Selecione"
            options={props.reports.map((r) => ({ value: String(r.id), label: r.name }))}
          />
        )}

        <Row icon={Building2} label="Centro de custos" htmlFor="costCenter">
          <input id="costCenter" name="costCenter" inputMode="numeric" placeholder="Selecione" defaultValue={props.defaults.costCenter} className="row-control" />
        </Row>

        {props.view?.deadline && (
          <p className="pt-3 text-sm text-muted">Prazo para entrar num relatório enviado: {props.view.deadline}.</p>
        )}

        <label htmlFor="description" className="visually-hidden">Observações</label>
        <textarea
          id="description"
          name="description"
          placeholder="Observações (opcional)"
          defaultValue={props.defaults.description}
          className="well mt-4 block min-h-32 w-full resize-none border-0 p-4 text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-focus"
        />

        <p className="mt-3 min-h-[1lh] text-sm text-error" aria-live="polite">{state?.policy ? "" : state?.error}</p>
        <button type="submit" className="btn-primary min-h-12 w-full text-base normal-case" disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </section>

      {showPolicy && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-ink/50 p-6">
          <div role="alertdialog" aria-modal="true" aria-labelledby="policy-title" aria-describedby="policy-text" className="surface-card w-full max-w-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="policy-title" className="font-display text-lg font-medium text-ink">Política de despesa</h2>
              <button type="button" aria-label="Fechar" onClick={() => setDismissed(state)} className="-mr-2 -mt-2 inline-flex h-10 w-10 items-center justify-center rounded-pill text-ink hover:bg-paper-2">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <p id="policy-text" className="mt-2 text-ink-2">{state!.error.replace("Política de despesa: é", "É")}</p>
            <div className="mt-5 flex justify-end">
              <label htmlFor="receipt" onClick={() => setDismissed(state)} className="btn-primary cursor-pointer normal-case">Inserir foto</label>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
