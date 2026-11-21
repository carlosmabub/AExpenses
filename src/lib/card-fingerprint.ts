import { createHmac } from "node:crypto";

/**
 * O número completo do cartão nunca é gravado. Guardamos só uma impressão digital
 * (HMAC com segredo do servidor), que identifica o cartão entre importações,
 * e os 4 últimos dígitos para exibição.
 */
function secret(): string {
  return process.env.AEX_CARD_SECRET || "aexpenses-dev-secret-troque-em-producao";
}

export function cardFingerprint(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  return createHmac("sha256", secret()).update(digits).digest("hex");
}

export function cardLast4(cardNumber: string): string {
  return cardNumber.replace(/\D/g, "").slice(-4);
}
