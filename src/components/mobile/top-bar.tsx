import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Faixa azul do topo: voltar, título e uma ação à direita (ex.: salvar). */
export function TopBar({ title, back, action, children }: { title: string; back?: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="-mx-4 bg-ink px-4 pb-6 pt-3 text-accent-ink">
      <div className="flex min-h-12 items-center gap-2">
        {back ? (
          <Link href={back} aria-label="Voltar" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-pill hover:bg-white/10">
            <ChevronLeft size={24} aria-hidden="true" />
          </Link>
        ) : (
          <span className="w-9" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-center font-display text-lg font-medium">{title}</h1>
        <span className="flex w-9 justify-end">{action}</span>
      </div>
      {children}
    </header>
  );
}
