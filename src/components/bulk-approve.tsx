"use client";

import { useEffect, useState } from "react";
import { approveSelectedAction } from "@/app/admin/actions";

const FORM_ID = "bulk-approve";

/**
 * Barra de aprovação em lote: "selecionar todas" e "aprovar selecionadas".
 * As caixas de cada despesa ficam na lista (name="expenseIds", form="bulk-approve").
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
    <form id={FORM_ID} action={approveSelectedAction} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex min-h-10 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--color-ink)]"
          checked={selected === total && total > 0}
          ref={(el) => { if (el) el.indeterminate = selected > 0 && selected < total; }}
          onChange={(e) => { boxes().forEach((b) => { b.checked = e.target.checked; }); setSelected(e.target.checked ? total : 0); }}
        />
        selecionar todas
      </label>
      <button type="submit" className="btn-primary" disabled={selected === 0}>
        aprovar selecionadas{selected > 0 ? ` (${selected})` : ""}
      </button>
    </form>
  );
}
