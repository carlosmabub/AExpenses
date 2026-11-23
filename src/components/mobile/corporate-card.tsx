import { Nfc } from "lucide-react";

/**
 * Logotipo oficial do banco (arquivo em public/), quando a empresa fornecer.
 * Não desenhamos a marca de memória: sem o arquivo, o nome aparece escrito.
 */
const LOGO_FILE: string | null = null; // ex.: "brand/bradesco.svg"
const hasLogo = LOGO_FILE !== null;

/**
 * O cartão Visa Empresarial Bradesco, nas proporções do cartão físico (85,6 × 54 mm):
 * marca no canto superior esquerdo, a marca grande e apagada ao fundo, chip e aproximação
 * no meio, número, titular e empresa embaixo, Visa Empresarial no canto inferior direito.
 */
export function CorporateCard({ last4, holder, company }: { last4: string; holder: string; company: string }) {
  return (
    <figure
      aria-label={`Cartão Visa Empresarial Bradesco, final ${last4}, ${holder}`}
      className="relative mx-auto aspect-[1.586/1] w-[88%] overflow-hidden rounded-[14px] bg-[radial-gradient(130%_130%_at_70%_30%,var(--color-card-light),var(--color-card-deep)_65%)] text-accent-ink shadow-card [container-type:inline-size]"
    >
      {/* marca grande ao fundo, no centro, só decoração */}
      {hasLogo ? (
        <img src={`/${LOGO_FILE}`} alt="" aria-hidden="true" className="pointer-events-none absolute left-[38%] top-[8%] h-[95%] w-auto opacity-[0.08] [filter:brightness(0)_invert(1)]" />
      ) : (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute left-[40%] top-[-6%] h-[78cqw] w-[78cqw] rounded-pill border-[7cqw] border-white/[0.06]" />
          <span aria-hidden="true" className="pointer-events-none absolute left-[55%] top-[22%] h-[40cqw] w-[40cqw] rounded-pill border-[5cqw] border-white/[0.05]" />
        </>
      )}

      {/* canto superior esquerdo: a marca do banco */}
      <div className="absolute left-[6%] top-[8%] flex h-[13%] items-center">
        {hasLogo ? (
          <img src={`/${LOGO_FILE}`} alt="Bradesco" className="h-full w-auto [filter:brightness(0)_invert(1)]" />
        ) : (
          <span className="font-display text-[7.5cqw] font-medium leading-none tracking-tight">bradesco</span>
        )}
      </div>

      {/* chip à esquerda e aproximação à direita, no meio do cartão */}
      <svg aria-hidden="true" viewBox="0 0 40 30" className="absolute left-[7%] top-[35%] w-[13%]">
        <rect x="0.5" y="0.5" width="39" height="29" rx="5" fill="var(--color-chip)" stroke="var(--color-chip-line)" />
        <path d="M13 0.5v29M27 0.5v29M0.5 10h12.5M27 10h12.5M0.5 20h12.5M27 20h12.5M13 15h14" stroke="var(--color-chip-line)" fill="none" />
      </svg>
      <Nfc aria-hidden="true" className="absolute right-[7%] top-[37%] h-[9cqw] w-[9cqw] opacity-90" />

      {/* número: só os 4 finais */}
      <p className="absolute left-[7%] right-[7%] top-[58%] flex justify-between font-display text-[6.6cqw] leading-none tabular-nums">
        <span aria-hidden="true">••••</span>
        <span aria-hidden="true">••••</span>
        <span aria-hidden="true">••••</span>
        <span>{last4}</span>
      </p>

      {/* titular e empresa */}
      <div className="absolute bottom-[8%] left-[7%] max-w-[55%] font-display text-[3.6cqw] leading-tight">
        <p className="truncate">{holder}</p>
        <p className="truncate opacity-85">{company}</p>
      </div>

      {/* Visa Empresarial */}
      <div className="absolute bottom-[7%] right-[7%] flex flex-col items-end leading-none">
        <span className="font-display text-[8.5cqw] font-medium italic tracking-tight">VISA</span>
        <span className="mt-[0.5cqw] text-[3cqw] opacity-85">Empresarial</span>
      </div>
    </figure>
  );
}
