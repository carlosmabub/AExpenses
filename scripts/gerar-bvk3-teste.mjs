#!/usr/bin/env node
// Gera um arquivo de cartões no layout BVK3 do Bradesco, com uma viagem de trabalho
// de um portador, para testar o app sem o arquivo real do banco.
//
//   node scripts/gerar-bvk3-teste.mjs [--portador MARCOS] [--final 2468] [--fim AAAA-MM-DD] [--saida arquivo.txt]
//
// --fim é o dia do último lançamento (padrão: ontem). Posições conforme src/lib/bvk3/parser.ts.

import { writeFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const holder = (args.portador ?? "MARCOS").toUpperCase();
const last4 = String(args.final ?? "2468").padStart(4, "0").slice(-4);
const out = args.saida ?? `tests/fixtures/BVK3-TESTE-${holder.split(" ")[0]}.txt`;
const company = "ASTEC";

const today = new Date();
const end = args.fim ? new Date(`${args.fim}T12:00:00Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1, 12));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");
const dmy = (d) => { const s = ymd(d); return s.slice(6, 8) + s.slice(4, 6) + s.slice(0, 4); };

/** Registro de 400 posições; set(pos, tamanho, valor) com posição 1-indexada como no layout. */
function record(type) {
  const chars = Array(400).fill(" ");
  const api = {
    set(pos, size, value, align = "left") {
      let v = String(value);
      v = align === "right" ? v.padStart(size, "0").slice(-size) : v.padEnd(size, " ").slice(0, size);
      for (let i = 0; i < size; i++) chars[pos - 1 + i] = v[i];
      return api;
    },
    num: (pos, size, n) => api.set(pos, size, String(n), "right"),
    toString: () => chars.join("").replace(/\s+$/, ""),
  };
  api.set(1, 1, type).set(2, 19, "A-0000-0000000");
  return api;
}

// Viagem técnica: Bebedouro -> Ribeirão Preto -> Campinas -> São Paulo -> volta
// [dia da viagem, estabelecimento, cidade, UF, MCC, ramo, valor em centavos, parcelas]
const trip = [
  [0, "POSTO SHELL TREVO", "BEBEDOURO", "SP", "05541", "POSTOS DE GASOLINA E DERIVADOS", 28940],
  [0, "VIAPAULISTA PEDAGIO", "RIBEIRAO PRET", "SP", "04784", "PEDAGIOS E TAXAS DE PONTES", 2380],
  [0, "RESTAURANTE DONA FIA", "RIBEIRAO PRET", "SP", "05812", "RESTAURANTES", 6890],
  [1, "HOTEL IBIS RIBEIRAO PRETO", "RIBEIRAO PRET", "SP", "07011", "HOTEIS E MOTEIS", 41200],
  [1, "PADARIA SAO JOSE", "RIBEIRAO PRET", "SP", "05462", "PADARIAS", 1850],
  [2, "CASA DAS FERRAMENTAS", "RIBEIRAO PRET", "SP", "05251", "LOJAS DE FERRAGENS E FERRAMENTAS", 15670],
  [2, "PROTEGE EPI", "RIBEIRAO PRET", "SP", "05137", "UNIFORMES E ROUPAS PROFISSIONAIS", 24800],
  [3, "POSTO IPIRANGA ANHANGUERA", "CAMPINAS", "SP", "05541", "POSTOS DE GASOLINA E DERIVADOS", 24510],
  [3, "RESTAURANTE VILLA MINEIRA", "CAMPINAS", "SP", "05812", "RESTAURANTES", 7430],
  [4, "ESTAPAR ESTACIONAMENTO", "CAMPINAS", "SP", "07523", "ESTACIONAMENTOS", 2800],
  [4, "HOTEL NACIONAL INN CAMPINAS", "CAMPINAS", "SP", "07011", "HOTEIS E MOTEIS", 39800],
  [4, "OUTBACK CAMPINAS", "CAMPINAS", "SP", "05812", "RESTAURANTES", 14260],
  [5, "LEROY MERLIN CAMPINAS", "CAMPINAS", "SP", "05200", "MATERIAIS DE CONSTRUCAO E FERRAGENS", 29900, 3],
  [5, "CAFE DO PONTO", "CAMPINAS", "SP", "05814", "LANCHONETES E FAST FOOD", 1590],
  [6, "UBER TRIP", "SAO PAULO", "SP", "04121", "TAXIS E TRANSPORTE POR APLICATIVO", 3245],
  [6, "RESTAURANTE FAMIGLIA", "SAO PAULO", "SP", "05812", "RESTAURANTES", 9650],
  [7, "99 POP", "SAO PAULO", "SP", "04121", "TAXIS E TRANSPORTE POR APLICATIVO", 2190],
  [7, "CORREIOS SEDEX", "SAO PAULO", "SP", "09402", "SERVICOS POSTAIS", 6420],
  [8, "POSTO BR BANDEIRANTES", "CAJAMAR", "SP", "05541", "POSTOS DE GASOLINA E DERIVADOS", 19830],
  [8, "AUTOBAN PEDAGIO", "JUNDIAI", "SP", "04784", "PEDAGIOS E TAXAS DE PONTES", 1970],
  [9, "RESTAURANTE FRANGO ASSADO", "LIMEIRA", "SP", "05812", "RESTAURANTES", 5640],
];

const start = addDays(end, -10);
const due = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 15, 12));
const cardNumber = `400000000000000${last4}`;
let seed = Number(last4) || 1;
const rand = (digits) => {
  let s = "";
  for (let i = 0; i < digits; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; s += String(seed % 10); }
  return s;
};

const lines = [];
lines.push(record("0").set(74, 40, company).set(133, 8, dmy(due)).set(141, 8, dmy(end)).set(157, 3, "400").toString());
lines.push(record("1").set(21, 19, "4000000000000000000").set(63, 30, company).toString());

const entries = trip.map(([day, merchant, city, uf, mcc, activity, cents, parcels]) => {
  const purchase = addDays(start, day);
  const posting = addDays(purchase, 1) > end ? end : addDays(purchase, 1);
  return record("2")
    .set(21, 19, cardNumber)
    .set(40, 23, `7${rand(22)}`)
    .set(63, 4, parcels ? "0603" : "0609")
    .set(67, 8, ymd(purchase))
    .set(75, 5, parcels ? `001${String(parcels).padStart(2, "0")}` : "00000")
    .num(80, 13, cents)
    .num(93, 15, cents * 10)
    .set(108, 8, ymd(due))
    .set(116, 3, "BRL")
    .set(119, 13, city)
    .set(132, 2, uf)
    .set(134, 45, merchant)
    .set(204, 5, mcc)
    .set(209, 1, "Z")
    .set(210, 30, activity)
    .set(240, 3, "R$")
    .set(243, 1, "D")
    .set(298, 15, city)
    .set(313, 2, uf)
    .set(376, 3, "BR")
    .set(383, 8, ymd(posting))
    .set(391, 6, rand(6))
    .toString();
});
const total = trip.reduce((s, t) => s + t[6], 0);
lines.push(
  record("1")
    .set(21, 19, cardNumber)
    .set(63, 30, holder)
    .set(153, 28, "BEBEDOURO")
    .set(181, 2, "SP")
    .set(325, 1, "+")
    .num(326, 17, total)
    .toString(),
);
lines.push(...entries);
lines.push(
  record("9")
    .set(21, 19, "9999999999999999999")
    .num(63, 7, 1)
    .num(70, 7, entries.length)
    .num(77, 7, entries.length + 4)
    .set(84, 1, "+")
    .num(85, 17, total)
    .set(102, 1, "+")
    .num(103, 17, 0)
    .set(120, 1, "+")
    .num(121, 17, 0)
    .toString(),
);

writeFileSync(out, Buffer.from(lines.join("\r\n") + "\r\n", "latin1"));
console.log(`${out}: ${entries.length} compras de ${holder} (cartão final ${last4}), ${ymd(start)} a ${ymd(end)}, total R$ ${(total / 100).toFixed(2).replace(".", ",")}`);
