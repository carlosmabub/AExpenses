/**
 * Leitor do arquivo de cartões Bradesco no layout BVK3 (registros de 400 posições).
 *
 * Registros:
 *   0 = cabeçalho (empresa, vencimento, processamento)
 *   1 = cartão/portador (abre um bloco; as linhas 2 seguintes são desse cartão)
 *   2 = lançamento (compra, saque, pagamento, saldo anterior...)
 *   9 = trailer com totais de conferência
 *
 * As posições do layout são 1-indexadas. O arquivo vem em latin-1, com CRLF e
 * com os espaços finais das linhas aparados, por isso cada linha é completada até 400.
 */

export const RECORD_LENGTH = 400;

export interface Bvk3Header {
  companyName: string;
  /** Vencimento da fatura (ISO yyyy-mm-dd) */
  dueDate: string | null;
  /** Data de processamento do arquivo (ISO) */
  processingDate: string | null;
  cnpj: string;
}

export interface Bvk3Card {
  /** Número do cartão ou billing account, como veio no arquivo. Nunca persistir. */
  cardNumber: string;
  holderName: string;
  city: string;
  state: string;
  costCenter: string;
  employeeCode: string;
  branch: string;
  /** Total do cartão no arquivo, em centavos, com sinal */
  totalBrlCents: number;
  line: number;
}

export type DebitCredit = "D" | "C";

export interface Bvk3Entry {
  cardNumber: string;
  /** Reference number Visa (identifica a transação) */
  reference: string;
  transactionCode: string;
  /** Data da compra (ISO) */
  purchaseDate: string | null;
  /** Parcela atual (0 = à vista) */
  installment: number;
  /** Total de parcelas (0 = à vista) */
  installmentsTotal: number;
  /** Valor lançado em R$, centavos */
  amountCents: number;
  /** Valor original, em milésimos da moeda original */
  originalAmountMillis: number;
  originalCurrency: string;
  city: string;
  state: string;
  description: string;
  merchantCnpj: string;
  mcc: string;
  activityDescription: string;
  debitCredit: DebitCredit;
  /** Data de postagem/lançamento (ISO) */
  postingDate: string | null;
  authorizationCode: string;
  line: number;
}

export interface Bvk3Trailer {
  cardholders: number;
  transactions: number;
  records: number;
  totalBrlCents: number;
}

export interface Bvk3File {
  header: Bvk3Header | null;
  cards: Bvk3Card[];
  entries: Bvk3Entry[];
  trailer: Bvk3Trailer | null;
  warnings: string[];
}

function field(line: string, start: number, size: number): string {
  return line.slice(start - 1, start - 1 + size);
}

function text(line: string, start: number, size: number): string {
  return field(line, start, size).trim();
}

function int(raw: string): number {
  const digits = raw.trim();
  if (!digits) return 0;
  if (!/^\d+$/.test(digits)) throw new Error(`valor numérico inválido: "${raw}"`);
  return Number.parseInt(digits, 10);
}

function signed(sign: string, raw: string): number {
  const value = int(raw);
  return sign === "-" ? -value : value;
}

/** ddmmyyyy -> yyyy-mm-dd */
function dateDMY(raw: string): string | null {
  const s = raw.trim();
  if (!/^\d{8}$/.test(s) || /^0+$/.test(s)) return null;
  return `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
}

/** yyyymmdd -> yyyy-mm-dd */
function dateYMD(raw: string): string | null {
  const s = raw.trim();
  if (!/^\d{8}$/.test(s) || /^0+$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function decodeBvk3(buffer: Uint8Array): string {
  return new TextDecoder("latin1").decode(buffer);
}

export function parseBvk3(content: string): Bvk3File {
  const result: Bvk3File = { header: null, cards: [], entries: [], trailer: null, warnings: [] };
  const lines = content.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    if (!rawLine.trim()) return;
    if (rawLine.length > RECORD_LENGTH) {
      result.warnings.push(`linha ${lineNumber}: ${rawLine.length} caracteres (esperado até ${RECORD_LENGTH})`);
    }
    const line = rawLine.padEnd(RECORD_LENGTH, " ");

    try {
      switch (line[0]) {
        case "0":
          result.header = {
            companyName: text(line, 74, 40),
            dueDate: dateDMY(field(line, 133, 8)),
            processingDate: dateDMY(field(line, 141, 8)),
            cnpj: text(line, 160, 15),
          };
          break;
        case "1":
          result.cards.push({
            cardNumber: text(line, 21, 19),
            holderName: text(line, 63, 30),
            city: text(line, 153, 28),
            state: text(line, 181, 2),
            costCenter: text(line, 208, 12),
            employeeCode: text(line, 282, 15),
            branch: text(line, 297, 10),
            totalBrlCents: signed(field(line, 325, 1), field(line, 326, 17)),
            line: lineNumber,
          });
          break;
        case "2": {
          const installment = field(line, 75, 5);
          const dc = field(line, 243, 1);
          result.entries.push({
            cardNumber: text(line, 21, 19),
            reference: text(line, 40, 23),
            transactionCode: text(line, 63, 4),
            purchaseDate: dateYMD(field(line, 67, 8)),
            installment: int(installment.slice(0, 3)),
            installmentsTotal: int(installment.slice(3, 5)),
            amountCents: int(field(line, 80, 13)),
            originalAmountMillis: int(field(line, 93, 15)),
            originalCurrency: text(line, 116, 3),
            city: text(line, 119, 13),
            state: text(line, 132, 2),
            description: text(line, 134, 45),
            merchantCnpj: text(line, 179, 14).replace(/^0+$/, ""),
            mcc: text(line, 204, 5),
            activityDescription: text(line, 210, 30),
            debitCredit: dc === "C" ? "C" : "D",
            postingDate: dateYMD(field(line, 383, 8)),
            authorizationCode: text(line, 391, 6),
            line: lineNumber,
          });
          if (dc !== "C" && dc !== "D") {
            result.warnings.push(`linha ${lineNumber}: indicador débito/crédito "${dc}" desconhecido, tratado como débito`);
          }
          break;
        }
        case "9":
          result.trailer = {
            cardholders: int(field(line, 63, 7)),
            transactions: int(field(line, 70, 7)),
            records: int(field(line, 77, 7)),
            totalBrlCents: signed(field(line, 84, 1), field(line, 85, 17)),
          };
          break;
        default:
          result.warnings.push(`linha ${lineNumber}: tipo de registro "${line[0]}" desconhecido, ignorada`);
      }
    } catch (error) {
      result.warnings.push(`linha ${lineNumber}: ${(error as Error).message}`);
    }
  });

  return result;
}

export interface Bvk3Check {
  ok: boolean;
  problems: string[];
  recordsRead: number;
  totalBrlCents: number;
}

/** Confere o que foi lido com os totais do trailer e dos registros de cartão. */
export function checkBvk3(file: Bvk3File): Bvk3Check {
  const problems: string[] = [];
  const recordsRead = (file.header ? 1 : 0) + file.cards.length + file.entries.length + (file.trailer ? 1 : 0);

  const perCard = new Map<string, number>();
  for (const e of file.entries) {
    const signedAmount = e.debitCredit === "C" ? -e.amountCents : e.amountCents;
    perCard.set(e.cardNumber, (perCard.get(e.cardNumber) ?? 0) + signedAmount);
  }
  const totalBrlCents = file.cards.reduce((sum, c) => sum + c.totalBrlCents, 0);

  if (!file.header) problems.push("arquivo sem cabeçalho (registro 0)");
  if (!file.trailer) {
    problems.push("arquivo sem trailer (registro 9)");
  } else {
    if (file.trailer.transactions !== file.entries.length) {
      problems.push(`trailer indica ${file.trailer.transactions} lançamentos, foram lidos ${file.entries.length}`);
    }
    if (file.trailer.records !== recordsRead) {
      problems.push(`trailer indica ${file.trailer.records} registros, foram lidos ${recordsRead}`);
    }
    if (file.trailer.totalBrlCents !== totalBrlCents) {
      problems.push(`trailer indica total ${file.trailer.totalBrlCents} centavos, soma dos cartões é ${totalBrlCents}`);
    }
  }
  for (const card of file.cards) {
    const sum = perCard.get(card.cardNumber) ?? 0;
    if (sum !== card.totalBrlCents) {
      problems.push(`cartão final ${card.cardNumber.slice(-4)}: lançamentos somam ${sum}, total do cartão é ${card.totalBrlCents}`);
    }
  }
  const knownCards = new Set(file.cards.map((c) => c.cardNumber));
  for (const e of file.entries) {
    if (!knownCards.has(e.cardNumber)) {
      problems.push(`linha ${e.line}: lançamento de cartão sem registro 1`);
    }
  }

  return { ok: problems.length === 0 && file.warnings.length === 0, problems: [...file.warnings, ...problems], recordsRead, totalBrlCents };
}
