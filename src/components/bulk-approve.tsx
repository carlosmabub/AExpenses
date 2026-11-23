"use client";

import { useEffect, useState } from "react";
import { approveSelectedAction } from "@/app/admin/actions";

const FORM_ID = "bulk-approve";

/**
 * Barra de aprovação em lote, na mesma grade das linhas da lista: "selecionar todas" fica sobre as caixas
 * das despesas (name="expenseIds", form="bulk-approve") e "aprovar selecionadas" na coluna de aprovar/devolver.
 */
export function BulkApprove({ total }: { total: number }) {
  const [selected, setSelected] = useState(0);
  const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="expenseIds"][form="${FORM_ID}"]`));
  useEffect(() => {
    const update = () => setSelected(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", update);
    return () => document.removeEventListener("change", update);
  }, []);
  return (
    <form id={FORM_ID} action={approveSelectedAction} className="mt-3 grid items-center gap-4 border-t border-rule py-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <label className="flex min-w-0 items-center gap-3 text-sm text-ink">
        <span className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-ink)]"
            checked={selected === total && total > 0}
            ref={(el) => { if (el) el.indeterminate = selected > 0 && selected < total; }}
            onChange={(e) => { boxes().forEach((b) => { b.checked = e.target.checked; }); setSelected(e.target.checked ? total : 0); }}
          />
        </span>
        selecionar todas
      </label>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={selected === 0}>
          aprovar selecionadas{selected > 0 ? ` (${selected})` : ""}
        </button>
      </div>
    </form>
  );
}
