export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Carregando…</span>
      <div className="h-8 w-64 animate-pulse rounded-pill bg-paper-3" aria-hidden="true" />
      <div className="mt-8 space-y-3" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-paper-2" />
        ))}
      </div>
    </div>
  );
}
