import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { categories, employees } from "@/db/schema";
import { seedIfEmpty } from "@/db/seed";
import { importBvk3 } from "@/lib/bvk3/import";
import { checkBvk3, decodeBvk3, parseBvk3 } from "@/lib/bvk3/parser";
import { setClock } from "@/lib/clock";
import { listEmployeeExpenses } from "@/lib/expenses";
import { hashPassword } from "@/lib/password";

// Arquivo gerado por scripts/gerar-bvk3-teste.mjs (viagem do Marcos)
const content = decodeBvk3(readFileSync(path.join(__dirname, "fixtures/BVK3-TESTE-MARCOS.txt")));

describe("arquivo de teste do Marcos", () => {
  it("segue o layout BVK3 e confere com o trailer", () => {
    const file = parseBvk3(content);
    const check = checkBvk3(file);
    expect(check.problems).toEqual([]);
    expect(file.entries).toHaveLength(21);
    expect(file.cards.find((c) => c.holderName === "MARCOS")?.cardNumber.slice(-4)).toBe("2468");
    expect(file.entries.find((e) => e.description === "LEROY MERLIN CAMPINAS")).toMatchObject({ transactionCode: "0603", installment: 1, installmentsTotal: 3 });
  });

  it("as compras vão para o Marcos, com o tipo sugerido pelo ramo", async () => {
    const db = await createDb(":memory:");
    await seedIfEmpty(db);
    await db.insert(employees).values({ name: "Marcos", email: "marcos@empresa.com.br", passwordHash: hashPassword("123456"), cardHolderName: "MARCOS" }).run();
    const result = await importBvk3(db, { fileName: "BVK3-TESTE-MARCOS.txt", content });
    expect(result).toMatchObject({ imported: true, checkOk: true, newTransactions: 21, unlinkedCards: [] });

    const last = parseBvk3(content).entries.map((e) => e.postingDate!).sort().at(-1)!;
    await setClock(db, new Date(new Date(`${last}T11:00:00Z`).getTime() + 86400000));
    const marcos = (await db.select().from(employees).where(eq(employees.email, "marcos@empresa.com.br")).get())!.id;
    const mine = await listEmployeeExpenses(db, marcos);
    expect(mine).toHaveLength(21);

    const names = new Map((await db.select().from(categories).all()).map((c) => [c.id, c.name]));
    const suggested = (merchant: string) => names.get(mine.find((e) => e.e.merchant === merchant)!.e.suggestedCategoryId!);
    expect(suggested("POSTO SHELL TREVO")).toBe("Combustível");
    expect(suggested("HOTEL IBIS RIBEIRAO PRETO")).toBe("Hospedagem");
    expect(suggested("RESTAURANTE DONA FIA")).toBe("Alimentação");
    expect(suggested("VIAPAULISTA PEDAGIO")).toBe("Pedágio/Estacionamento");
    expect(suggested("UBER TRIP")).toBe("Transporte");
    expect(suggested("PROTEGE EPI")).toBe("EPIs");
    expect(suggested("CASA DAS FERRAMENTAS")).toBe("Ferramentas e equipamentos");
    expect(suggested("CORREIOS SEDEX")).toBe("Frete e envio");
  });
});
