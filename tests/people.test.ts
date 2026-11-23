import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/db";
import { cards, categories, employees, expenses } from "@/db/schema";
import { seedIfEmpty } from "@/db/seed";
import { importBvk3 } from "@/lib/bvk3/import";
import { setClock } from "@/lib/clock";
import { createReport } from "@/lib/reports";
import { createManualExpense, listAdminExpenses, listEmployeeExpenses, moveExpensesToReport, saveExpense } from "@/lib/expenses";
import { decodeBvk3 } from "@/lib/bvk3/parser";
import { approveRemaining, listReportsForApproval, reviewExpense, submitReport } from "@/lib/reports";
import { assignCards, canReview, deletePerson, inAlertWindow, linkCardTo, reactivatePerson, savePerson, setLeader, setTeam, teamAlerts, teamSpending, terminatePerson } from "@/lib/people";

const sample = decodeBvk3(readFileSync(path.join(__dirname, "fixtures/BVK3EXEMPLOMENSAL.txt")));
const RECEIPT = { receiptPath: "teste.jpg", receiptMime: "image/jpeg" };

describe("equipes, aprovadores e desligamento", () => {
  let db: Db;
  let admin: number, ana: number, bruno: number, diego: number, alimentacao: number;
  let lider: number;

  const id = async (name: string) => (await db.select().from(employees).where(eq(employees.name, name)).get())!.id;

  async function sendReport(owner: number, n = 2) {
    const reportId = await createReport(db, { employeeId: owner, name: "Relatório", costCenter: "1", notes: "", advanceIds: [] });
    const ids = (await listEmployeeExpenses(db, owner)).slice(0, n).map((e) => e.e.id);
    await moveExpensesToReport(db, { employeeId: owner, expenseIds: ids, reportId });
    for (const e of ids) await saveExpense(db, { expenseId: e, employeeId: owner, categoryId: alimentacao, description: "Visita", costCenter: "1", ...RECEIPT });
    await submitReport(db, { reportId, employeeId: owner });
    return { reportId, ids };
  }

  beforeEach(async () => {
    db = await createDb(":memory:");
    await seedIfEmpty(db);
    await importBvk3(db, { fileName: "exemplo.txt", content: sample });
    await setClock(db, new Date("2013-07-25T12:00:00Z"));
    admin = (await db.select().from(employees).where(eq(employees.role, "admin")).get())!.id;
    ana = await id("Ana Souza");
    bruno = await id("Bruno Lima");
    diego = await id("Diego Rocha");
    alimentacao = (await db.select().from(categories).where(eq(categories.name, "Alimentação")).get())!.id;
    lider = await savePerson(db, null, { name: "Lúcia Lider", email: "lucia@empresa.com.br", password: "secreta1", role: "aprovador", costCenter: "10", cardHolderName: "", leaderId: null, cardIds: [], teamIds: [diego] });
  });

  it("aprovador só aprova a equipe dele; sem líder vai para o admin", async () => {
    const { reportId, ids } = await sendReport(diego);
    const outro = await savePerson(db, null, { name: "Outro Lider", email: "outro@empresa.com.br", password: "secreta1", role: "aprovador", costCenter: "", cardHolderName: "", leaderId: null, cardIds: [], teamIds: [] });
    await expect(reviewExpense(db, { expenseId: ids[0], reviewerId: outro, decision: "aprovada", comment: "" })).rejects.toThrow(/não pode aprovar/);
    await expect(approveRemaining(db, { reportId, reviewerId: bruno })).rejects.toThrow();
    await reviewExpense(db, { expenseId: ids[0], reviewerId: lider, decision: "aprovada", comment: "" });
    expect((await listReportsForApproval(db, { id: lider, role: "aprovador" })).map((r) => r.report.id)).toEqual([reportId]);
    expect(await listReportsForApproval(db, { id: outro, role: "aprovador" })).toHaveLength(0);
    // Ana não tem líder: só o admin aprova
    const a = await sendReport(bruno);
    expect(await canReview(db, { id: lider, role: "aprovador" }, bruno)).toBe(false);
    expect(await canReview(db, { id: admin, role: "admin" }, bruno)).toBe(true);
    await approveRemaining(db, { reportId: a.reportId, reviewerId: admin });
    // o aprovador não aprova o próprio relatório
    expect(await canReview(db, { id: lider, role: "aprovador" }, lider)).toBe(false);
  });

  it("setLeader e setTeam são coerentes e impedem ciclo", async () => {
    await setTeam(db, lider, [diego, bruno]);
    expect((await db.select().from(employees).where(eq(employees.id, bruno)).get())!.leaderId).toBe(lider);
    await setTeam(db, lider, [bruno]);
    expect((await db.select().from(employees).where(eq(employees.id, diego)).get())!.leaderId).toBeNull();
    await expect(setLeader(db, lider, lider)).rejects.toThrow(/si mesma/);
    const b = await savePerson(db, null, { name: "Chefe B", email: "b@empresa.com.br", password: "secreta1", role: "aprovador", costCenter: "", cardHolderName: "", leaderId: lider, cardIds: [], teamIds: [] });
    await expect(setLeader(db, lider, b)).rejects.toThrow(/ciclo/);
    await expect(setLeader(db, ana, ana)).rejects.toThrow();
    await expect(setLeader(db, ana, diego)).rejects.toThrow(/aprovador/); // funcionário comum não lidera
  });

  it("desligar mantém o histórico mesmo passando o cartão para outra pessoa", async () => {
    const before = (await listEmployeeExpenses(db, diego)).length;
    expect(before).toBeGreaterThan(0);
    const { reportId } = await sendReport(diego);
    const card = (await db.select().from(cards).where(eq(cards.employeeId, diego)).get())!;
    await setLeader(db, diego, lider);
    await terminatePerson(db, diego, "2013-07-26");
    const gone = (await db.select().from(employees).where(eq(employees.id, diego)).get())!;
    expect(gone.active).toBe(false);
    expect(gone.terminatedAt).toBe("2013-07-26");
    expect((await db.select().from(cards).where(eq(cards.id, card.id)).get())!.employeeId).toBeNull();
    // cartão vai para a Ana: histórico do Diego não se move, só o que ainda não tinha dono
    await linkCardTo(db, card.id, ana);
    expect((await listAdminExpenses(db, { employeeId: diego })).length).toBe(before);
    expect((await listAdminExpenses(db, { employeeId: ana, ownerIds: undefined })).filter((r) => r.card?.id === card.id)).toHaveLength(0);
    // compras novas desse cartão (novo arquivo) vão para a Ana
    await expect(deletePerson(db, diego)).rejects.toThrow(/histórico/);
    expect((await db.select().from(expenses).where(eq(expenses.employeeId, diego)).all()).length).toBeGreaterThanOrEqual(before);
    expect(reportId).toBeGreaterThan(0);
    await reactivatePerson(db, diego);
    expect((await db.select().from(employees).where(eq(employees.id, diego)).get())!.active).toBe(true);
  });

  it("desligar tira os liderados do líder; excluir só sem histórico", async () => {
    await setTeam(db, lider, [bruno]);
    await terminatePerson(db, lider, "2013-07-26");
    expect((await db.select().from(employees).where(eq(employees.id, bruno)).get())!.leaderId).toBeNull();
    const novo = await savePerson(db, null, { name: "Errado", email: "errado@empresa.com.br", password: "secreta1", role: "funcionario", costCenter: "", cardHolderName: "", leaderId: null, cardIds: [], teamIds: [] });
    await deletePerson(db, novo);
    expect(await db.select().from(employees).where(eq(employees.id, novo)).get()).toBeUndefined();
  });

  it("cartão: vincular dá dono às despesas sem dono; desmarcar solta o cartão", async () => {
    const card = (await db.select().from(cards).all()).find((c) => c.holderName === "NOME DO PORTADOR 09")!;
    expect((await listAdminExpenses(db, { unlinked: true })).length).toBeGreaterThan(0);
    await assignCards(db, ana, [card.id]);
    expect((await listAdminExpenses(db, { unlinked: true })).length).toBe(0);
    await assignCards(db, ana, []);
    expect((await db.select().from(cards).where(eq(cards.id, card.id)).get())!.employeeId).toBeNull();
    // despesas já têm dono fixo: continuam com a Ana
    expect((await listAdminExpenses(db, { unlinked: true })).length).toBe(0);
  });

  it("aviso só nos 3 últimos dias do mês e só do que vence no mês", async () => {
    expect(inAlertWindow(new Date("2013-07-27T12:00:00Z"))).toBe(false);
    expect(inAlertWindow(new Date("2013-07-28T12:00:00Z"))).toBe(true);
    expect(await teamAlerts(db, lider, new Date("2013-07-20T12:00:00Z"))).toEqual([]);
    const alerts = await teamAlerts(db, lider, new Date("2013-07-29T12:00:00Z"));
    expect(alerts.map((a) => a.person.id)).toEqual([diego]);
    expect(alerts[0].count).toBeGreaterThan(0);
    // depois de enviar o relatório, a despesa sai do aviso
    const total = alerts[0].count;
    await sendReport(diego, 2);
    const after = await teamAlerts(db, lider, new Date("2013-07-29T12:00:00Z"));
    expect(after[0].count).toBe(total - 2);
  });

  it("gasto da equipe por pessoa, tipo e status", async () => {
    const s = await teamSpending(db, lider, "2013-07");
    expect(s.count).toBeGreaterThan(0);
    expect(s.byPerson).toHaveLength(1);
    expect(s.totalCents).toBe(s.byPerson[0].totalCents);
    expect(s.byStatus.reduce((t, l) => t + l.totalCents, 0)).toBe(s.totalCents);
    const vazio = await teamSpending(db, ana, "2013-07");
    expect(vazio.count).toBe(0);
  });
});
