/** Aparece na hora ao trocar de tela, enquanto os dados chegam do servidor. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Carregando…</span>
      <div className="-mx-4 h-40 bg-ink" />
      <div className="-mt-12 space-y-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface-card flex items-center gap-3 p-4">
            <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-paper-3" />
            <span className="flex-1 space-y-2">
              <span className="block h-3 w-2/3 animate-pulse rounded-pill bg-paper-3" />
              <span className="block h-3 w-1/3 animate-pulse rounded-pill bg-paper-2" />
            </span>
            <span className="h-4 w-16 animate-pulse rounded-pill bg-paper-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
