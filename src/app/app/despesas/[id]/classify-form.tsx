"use client";

import { useActionState, useState } from "react";
import { Camera } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
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
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="transactionId" value={props.transactionId} />

      <fieldset>
        <legend className="label">categoria</legend>
        <div className="flex flex-wrap gap-2">
          {props.categories.map((c) => (
            <label key={c.id} className="relative">
              <input
                type="radio"
                name="categoryId"
                value={c.id}
                required
                defaultChecked={props.defaultCategoryId === c.id}
                className="peer absolute h-px w-px opacity-0"
              />
              <span className="pill min-h-10 cursor-pointer gap-2 px-4 text-sm transition-colors duration-100 hover:bg-paper-2 peer-checked:bg-accent peer-checked:text-accent-ink peer-checked:shadow-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                <CategoryIcon name={c.icon} size={16} />
                {c.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="description">do que se trata?</label>
        <textarea
          className="textarea"
          id="description"
          name="description"
          required
          placeholder="Ex.: almoço com o cliente X durante a visita técnica"
          defaultValue={props.defaultDescription}
        />
      </div>

      <div>
        <label className="label" htmlFor="costCenter">centro de custo</label>
        <input className="input" id="costCenter" name="costCenter" inputMode="numeric" defaultValue={props.defaultCostCenter} />
      </div>

      <div>
        <span className="label">comprovante</span>
        <label className="well flex cursor-pointer flex-col items-center gap-2 p-5 text-center text-sm text-ink-2 transition-colors duration-100 hover:bg-paper-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
          {preview ? (
            <img src={preview} alt="Prévia do comprovante" className="max-h-48 rounded-card" />
          ) : (
            <Camera size={28} strokeWidth={1.5} aria-hidden="true" className="text-muted" />
          )}
          <span className="font-display lowercase">
            {fileName ?? (props.hasReceipt ? "comprovante enviado, toque para trocar" : "tirar foto ou escolher arquivo")}
          </span>
          <input
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
      </div>

      <p className="min-h-[1lh] text-sm text-error" aria-live="polite">{error}</p>
      <button type="submit" className="btn-primary min-h-12 w-full text-base" disabled={pending} aria-busy={pending}>
        {pending ? "salvando…" : "salvar"}
      </button>
    </form>
  );
}
