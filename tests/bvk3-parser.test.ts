import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkBvk3, decodeBvk3, parseBvk3 } from "@/lib/bvk3/parser";
import { entryKind } from "@/lib/bvk3/codes";

const sample = decodeBvk3(readFileSync(path.join(__dirname, "fixtures/BVK3EXEMPLOMENSAL.txt")));

describe("parseBvk3 com o arquivo de exemplo do Bradesco", () => {
  const file = parseBvk3(sample);

  it("lê cabeçalho e trailer", () => {
    expect(file.header).toMatchObject({ companyName: "NOME DA EMPRESA", dueDate: "2013-08-15", processingDate: "2013-08-06" });
    expect(file.trailer).toEqual({ cardholders: 9, transactions: 99, records: 111, totalBrlCents: 301985 });
  });

  it("confere com o trailer sem divergências", () => {
    const check = checkBvk3(file);
    expect(check.problems).toEqual([]);
    expect(check.ok).toBe(true);
    expect(check.totalBrlCents).toBe(301985);
    expect(file.entries).toHaveLength(99);
    expect(file.cards).toHaveLength(10);
  });

  it("lê os dados do portador", () => {
    const card = file.cards.find((c) => c.holderName === "NOME DO PORTADOR 04")!;
    expect(card).toMatchObject({ costCenter: "4383", totalBrlCents: 85175, city: "BEBEDOURO" });
    expect(card.cardNumber.slice(-4)).toBe("4000");
  });

  it("lê uma compra à vista", () => {
    const entry = file.entries.find((e) => e.description === "MINI MERCADO BRASIL")!;
    expect(entry).toMatchObject({
      transactionCode: "0609",
      purchaseDate: "2013-07-13",
      postingDate: "2013-07-15",
      installment: 0,
      installmentsTotal: 0,
      amountCents: 1000,
      originalAmountMillis: 10000,
      originalCurrency: "BRL",
      city: "BEBEDOURO",
      merchantCnpj: "02554455000184",
      mcc: "05411",
      activityDescription: "SUPERMERCADOS",
      debitCredit: "D",
      authorizationCode: "610369",
    });
    expect(entryKind(entry)).toBe("compra");
  });

  it("lê a parcela de uma compra parcelada", () => {
    const entry = file.entries.find((e) => e.description === "BFSJP 35")!;
    expect(entry).toMatchObject({ transactionCode: "0603", installment: 5, installmentsTotal: 5, amountCents: 13380, purchaseDate: "2013-03-23" });
  });

  it("separa compras, saques e lançamentos que não são gasto", () => {
    const kinds = file.entries.reduce<Record<string, number>>((acc, e) => {
      const k = entryKind(e);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    // 8 saldos anteriores + 8 pagamentos + 1 ajuste de saque
    expect(kinds).toEqual({ compra: 78, saque: 4, ignorado: 17 });
  });

  it("aponta divergência quando o trailer não bate", () => {
    const tampered = sample.replace("+00000000000301985", "+00000000000301986");
    const check = checkBvk3(parseBvk3(tampered));
    expect(check.ok).toBe(false);
    expect(check.problems.join(" ")).toMatch(/trailer indica total/);
  });
});
