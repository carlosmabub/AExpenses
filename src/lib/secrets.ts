/**
 * Segredos do servidor. Na Vercel são obrigatórios; localmente há um valor de desenvolvimento.
 */
export function serverSecret(name: "AEX_SESSION_SECRET" | "AEX_CARD_SECRET", devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.VERCEL) throw new Error(`Configure a variável de ambiente ${name} no projeto da Vercel.`);
  return devDefault;
}
