import { Nfc } from "lucide-react";

/** O cartão Visa Empresarial Bradesco, desenhado com os dados que temos: os 4 finais e o titular. */
export function CorporateCard({ last4, holder }: { last4: string; holder: string }) {
  return (
    <figure
      aria-label={`Cartão Visa Empresarial Bradesco, final ${last4}, ${holder}`}
      className="relative mx-auto flex aspect-[1.586/1] w-[88%] flex-col justify-between overflow-hidden rounded-card bg-[radial-gradient(120%_120%_at_85%_20%,var(--color-card-light),var(--color-card-deep)_60%)] p-5 text-accent-ink shadow-card"
    >
      {/* arcos do desenho do cartão, só decoração */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-10 h-64 w-64 rounded-pill border-[18px] border-white/[0.06]" />
      <span aria-hidden="true" className="pointer-events-none absolute -right-4 top-6 h-40 w-40 rounded-pill border-[14px] border-white/[0.05]" />

      <div className="relative flex items-start justify-between">
        <span className="font-display text-xl font-medium tracking-tight">bradesco</span>
        <span className="text-xs opacity-75">Cartão corporativo</span>
      </div>

      <div className="relative flex items-center gap-3">
        <svg aria-hidden="true" viewBox="0 0 40 30" className="h-8 w-10">
          <rect x="0.5" y="0.5" width="39" height="29" rx="5" fill="var(--color-chip)" stroke="var(--color-chip-line)" />
          <path d="M13 0.5v29M27 0.5v29M0.5 10h12.5M27 10h12.5M0.5 20h12.5M27 20h12.5M13 15h14" stroke="var(--color-chip-line)" fill="none" />
        </svg>
        <Nfc size={22} aria-hidden="true" className="opacity-80" />
      </div>

      <p className="relative font-display text-xl tabular-nums tracking-[0.18em]">
        <span aria-hidden="true">••••&nbsp;••••&nbsp;••••&nbsp;</span>
        {last4}
      </p>

      <div className="relative flex items-end justify-between gap-3">
        <span className="min-w-0 truncate text-sm">{holder}</span>
        <span className="flex shrink-0 flex-col items-end leading-none">
          <span className="font-display text-2xl font-medium italic tracking-tight">VISA</span>
          <span className="text-[11px] opacity-80">Empresarial</span>
        </span>
      </div>
    </figure>
  );
}
