"use client";

import { useActionState, useState } from "react";
import { classify } from "./actions";

interface Props {
  transactionId: number;
  categories: { id: number; name: string; icon: string }[];
  defaultCategoryId: number | null;
  defaultDescription: string;
  defaultCostCenter: string;
  hasReceipt: boolean;
}

export function ClassifyForm(props: Props) {
  const [error, action, pending] = useActionState(classify, null);
  const [categoryId, setCategoryId] = useState<number | null>(props.defaultCategoryId);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="transactionId" value={props.transactionId} />
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />

      <div>
        <span className="label">Categoria</span>
        <div className="grid grid-cols-3 gap-2">
          {props.categories.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center text-[11px] leading-tight break-all ring-1 transition ${
                categoryId === c.id ? "bg-brand-600 font-semibold text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200"
              }`}
            >
              <span className="text-xl">{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">Do que se trata?</label>
        <textarea className="input min-h-20" id="description" name="description" required placeholder="Ex.: almoço com o cliente X durante a visita técnica" defaultValue={props.defaultDescription} />
      </div>

      <div>
        <label className="label" htmlFor="costCenter">Centro de custo</label>
        <input className="input" id="costCenter" name="costCenter" defaultValue={props.defaultCostCenter} />
      </div>

      <div>
        <span className="label">Comprovante</span>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          {preview ? <img src={preview} alt="Prévia do comprovante" className="max-h-48 rounded-lg" /> : <span className="text-3xl">📷</span>}
          {preview ? "Trocar foto" : props.hasReceipt ? "Comprovante enviado · toque para trocar" : "Tirar foto ou escolher arquivo"}
          <input
            type="file"
            name="receipt"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full py-3 text-base" disabled={pending || !categoryId}>
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
