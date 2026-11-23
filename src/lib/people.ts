import { and, asc, eq, inArray, isNull, like, ne, sql } from "drizzle-orm";
import type { Db, DbLike } from "@/db";
import { advances, cards, employees, expenses, reports, transactions, type Employee } from "@/db/schema";
import { ExpenseError, listAdminExpenses, type ExpenseRow } from "@/lib/expenses";
import { hashPassword } from "@/lib/password";

export type Role = Employee["role"];

export const ROLE_LABELS: Record<Role, string> = {
  funcionario: "Funcionário",
  aprovador: "Aprovador",
  admin: "Administrador",
};

/** Quem pode aprovar: admin e aprovador (líder). */
export function isApprover(user: Pick<Employee, "role">): boolean {
  return user.role === "aprovador" || user.role === "admin";
}

/** Nome para listas e filtros: desligados ficam marcados. */
export function displayName(e: Pick<Employee, "name" | "active">): string {
  return e.active ? e.name : `${e.name} (desligado)`;
}

export async function listPeople(db: DbLike): Promise<Employee[]> {
  return db.select().from(employees).orderBy(asc(employees.name)).all();
}

export async function getPerson(db: DbLike, id: number): Promise<Employee | undefined> {
  return db.select().from(employees).where(eq(employees.id, id)).get();
}

/** Liderados diretos (ativos e desligados). */
export async function teamOf(db: DbLike, leaderId: number): Promise<Employee[]> {
  return db.select().from(employees).where(eq(employees.leaderId, leaderId)).orderBy(asc(employees.name)).all();
}

/**
 * Pode revisar o relatório de `ownerId`? Admin revisa tudo; aprovador só os dos liderados diretos.
 * Sem líder, o relatório fica com o admin.
 */
export async function canReview(db: DbLike, reviewer: Pick<Employee, "id" | "role">, ownerId: number): Promise<boolean> {
  if (reviewer.role === "admin") return true;
  if (reviewer.role !== "aprovador" || reviewer.id === ownerId) return false;
  const owner = await getPerson(db, ownerId);
  return owner?.leaderId === reviewer.id;
}

/** true se `candidate` estiver acima de `personId` na cadeia de líderes (ou for ele mesmo). */
async function wouldCycle(db: DbLike, personId: number, newLeaderId: number): Promise<boolean> {
  const all = await db.select({ id: employees.id, leaderId: employees.leaderId }).from(employees).all();
  const leaderOf = new Map(all.map((e) => [e.id, e.leaderId]));
  let cursor: number | null | undefined = newLeaderId;
  for (let i = 0; cursor != null && i <= all.length; i++) {
    if (cursor === personId) return true;
    cursor = leaderOf.get(cursor);
  }
  return false;
}

async function checkLeader(db: DbLike, personId: number, leaderId: number): Promise<void> {
  const leader = await getPerson(db, leaderId);
  if (!leader || !leader.active || !isApprover(leader)) throw new ExpenseError("O líder precisa ser um aprovador ativo.");
  if (await wouldCycle(db, personId, leaderId)) {
    throw new ExpenseError(leaderId === personId ? "Uma pessoa não pode ser líder de si mesma." : "Esse líder já responde a esta pessoa (seria um ciclo).");
  }
}

/** Define o líder de uma pessoa (null: sem líder, aprova o admin). */
export async function setLeader(db: DbLike, personId: number, leaderId: number | null): Promise<void> {
  if (leaderId) await checkLeader(db, personId, leaderId);
  await db.update(employees).set({ leaderId }).where(eq(employees.id, personId)).run();
}

/** Marca os liderados de um líder: quem está na lista passa a ter esse líder; quem saiu da lista fica sem líder. */
export async function setTeam(db: Db, leaderId: number, memberIds: number[]): Promise<void> {
  const ids = [...new Set(memberIds)].filter((id) => id !== leaderId);
  for (const id of ids) await checkLeader(db, id, leaderId);
  await db.transaction(async (tx) => {
    const current = await tx.select({ id: employees.id }).from(employees).where(eq(employees.leaderId, leaderId)).all();
    const removed = current.map((c) => c.id).filter((id) => !ids.includes(id));
    if (removed.length) await tx.update(employees).set({ leaderId: null }).where(inArray(employees.id, removed)).run();
    if (ids.length) await tx.update(employees).set({ leaderId }).where(inArray(employees.id, ids)).run();
  });
}

/**
 * Define quais cartões são da pessoa. Cartões desmarcados ficam sem dono.
 * As despesas antigas não mudam de dono: só as que ainda não têm dono passam para a pessoa.
 */
export async function assignCards(db: Db, personId: number, cardIds: number[]): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx.select({ id: cards.id }).from(cards).where(eq(cards.employeeId, personId)).all();
    const removed = current.map((c) => c.id).filter((id) => !cardIds.includes(id));
    if (removed.length) await tx.update(cards).set({ employeeId: null }).where(inArray(cards.id, removed)).run();
    for (const cardId of cardIds) await linkCardTo(tx, cardId, personId);
  });
}

/** Vincula um cartão (ou desvincula com null) e dá dono às despesas dele que ainda não têm. */
export async function linkCardTo(db: DbLike, cardId: number, personId: number | null): Promise<void> {
  await db.update(cards).set({ employeeId: personId }).where(eq(cards.id, cardId)).run();
  if (!personId) return;
  await db
    .update(expenses)
    .set({ employeeId: personId })
    .where(
      and(
        isNull(expenses.employeeId),
        inArray(expenses.transactionId, db.select({ id: transactions.id }).from(transactions).where(eq(transactions.cardId, cardId))),
      ),
    )
    .run();
}

export const PENDING_PREFIX = "pending:";

/**
 * Associa um cartão à pessoa pelos 4 últimos dígitos.
 * - Se o arquivo do banco já trouxe um cartão com esses dígitos e sem dono, ele é vinculado.
 * - Se não existe nenhum: no piloto (`strict` falso) fica um cartão reservado, que a próxima importação com
 *   esses dígitos preenche; em produção (`strict` verdadeiro) recusa, pois o cartão precisa existir no banco.
 */
export async function addCardByDigits(db: DbLike, personId: number, digits: string, strict: boolean): Promise<void> {
  const last4 = digits.trim();
  if (!/^\d{4}$/.test(last4)) throw new ExpenseError("Digite os 4 últimos dígitos do cartão.");
  const matches = await db.select().from(cards).where(and(eq(cards.last4, last4), eq(cards.isBillingAccount, false))).all();
  const mine = matches.find((c) => c.employeeId === personId);
  if (mine) return;
  const free = matches.filter((c) => !c.employeeId);
  if (free.length) {
    for (const c of free) await linkCardTo(db, c.id, personId);
    return;
  }
  if (matches.length) {
    const owner = await getPerson(db, matches[0].employeeId!);
    throw new ExpenseError(`O cartão final ${last4} já está com ${owner?.name ?? "outra pessoa"}. Desvincule lá antes.`);
  }
  if (strict) throw new ExpenseError(`Não encontrei o cartão final ${last4} nos arquivos do banco. Confira os dígitos ou importe o arquivo que traz esse cartão.`);
  await db.insert(cards).values({ fingerprint: `${PENDING_PREFIX}${personId}:${last4}`, last4, holderName: "", employeeId: personId }).onConflictDoNothing().run();
}

export interface PersonInput {
  name: string;
  email: string;
  password?: string;
  role: Role;
  costCenter: string;
  /** Só altera se vier preenchido (o vínculo de cartão agora é pelos dígitos) */
  cardHolderName?: string;
  leaderId: number | null;
  /** Cartões que continuam com a pessoa; os outros dela são soltos */
  cardIds: number[];
  /** 4 últimos dígitos de um cartão a adicionar */
  newCardLast4?: string;
  /** Produção: o cartão digitado precisa existir nos arquivos do banco */
  strictCards?: boolean;
  /** Liderados (só vale para aprovador/admin) */
  teamIds: number[];
}

/** Cria ou atualiza o cadastro completo de uma pessoa. Devolve o id. */
export async function savePerson(db: Db, id: number | null, input: PersonInput): Promise<number> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new ExpenseError("Informe o nome.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ExpenseError("Informe um e-mail válido.");
  const clash = await db.select({ id: employees.id }).from(employees).where(eq(employees.email, email)).get();
  if (clash && clash.id !== id) throw new ExpenseError("Já existe um usuário com esse e-mail.");
  if (!id && !input.password) throw new ExpenseError("Defina uma senha inicial.");
  if (input.password && input.password.length < 6) throw new ExpenseError("A senha precisa ter pelo menos 6 caracteres.");

  const values = {
    name,
    email,
    role: input.role,
    costCenter: input.costCenter.trim(),
    ...(input.cardHolderName !== undefined ? { cardHolderName: input.cardHolderName.trim().toUpperCase() } : {}),
    ...(input.password ? { passwordHash: hashPassword(input.password) } : {}),
  };
  let personId = id;
  if (personId) {
    const before = await getPerson(db, personId);
    if (!before) throw new ExpenseError("Usuário não encontrado.");
    // Quem deixa de ser aprovador perde os liderados (eles voltam para o admin)
    if (isApprover(before) && !isApprover(values)) await db.update(employees).set({ leaderId: null }).where(eq(employees.leaderId, personId)).run();
    await db.update(employees).set(values).where(eq(employees.id, personId)).run();
  } else {
    personId = (await db.insert(employees).values({ ...values, passwordHash: values.passwordHash! }).returning({ id: employees.id }).get()).id;
  }
  await setLeader(db, personId, input.leaderId);
  await assignCards(db, personId, input.cardIds);
  if (input.newCardLast4?.trim()) await addCardByDigits(db, personId, input.newCardLast4, Boolean(input.strictCards));
  if (isApprover(values)) await setTeam(db, personId, input.teamIds);
  return personId;
}

/**
 * Desliga: não entra mais no app, os cartões ficam sem dono e os liderados ficam sem líder (aprovação vai ao admin).
 * Despesas, relatórios e adiantamentos continuam com ele (histórico).
 */
export async function terminatePerson(db: Db, id: number, date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ExpenseError("Informe a data do desligamento.");
  await db.transaction(async (tx) => {
    await tx.update(employees).set({ active: false, terminatedAt: date }).where(eq(employees.id, id)).run();
    await tx.update(cards).set({ employeeId: null }).where(eq(cards.employeeId, id)).run();
    await tx.update(employees).set({ leaderId: null }).where(eq(employees.leaderId, id)).run();
  });
}

export async function reactivatePerson(db: DbLike, id: number): Promise<void> {
  await db.update(employees).set({ active: true, terminatedAt: null }).where(eq(employees.id, id)).run();
}

export async function hasHistory(db: DbLike, id: number): Promise<boolean> {
  const [e, r, a] = await Promise.all([
    db.select({ id: expenses.id }).from(expenses).where(eq(expenses.employeeId, id)).get(),
    db.select({ id: reports.id }).from(reports).where(eq(reports.employeeId, id)).get(),
    db.select({ id: advances.id }).from(advances).where(eq(advances.employeeId, id)).get(),
  ]);
  return Boolean(e || r || a);
}

/** Excluir só quem nunca teve despesa, relatório ou adiantamento (cadastro errado). Os outros são desligados. */
export async function deletePerson(db: Db, id: number): Promise<void> {
  if (await hasHistory(db, id)) throw new ExpenseError("Este usuário tem histórico: desligue em vez de excluir.");
  await db.transaction(async (tx) => {
    await tx.update(cards).set({ employeeId: null }).where(eq(cards.employeeId, id)).run();
    await tx.update(employees).set({ leaderId: null }).where(eq(employees.leaderId, id)).run();
    await tx.delete(employees).where(and(eq(employees.id, id), ne(employees.role, "admin"))).run();
  });
}

const BRT_OFFSET_MS = 3 * 3600 * 1000;

/** Dia e último dia do mês em Brasília. */
function brtMonth(at: Date) {
  const local = new Date(at.getTime() - BRT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return { y, m, day: local.getUTCDate(), lastDay: new Date(Date.UTC(y, m + 1, 0)).getUTCDate() };
}

/** Faltam 3 dias ou menos para o fim do mês (em Brasília)? */
export function inAlertWindow(at: Date): boolean {
  const { day, lastDay } = brtMonth(at);
  return lastDay - day <= 3;
}

export interface TeamAlert {
  person: { id: number; name: string };
  count: number;
  totalCents: number;
}

/**
 * Aviso ao líder nos 3 últimos dias do mês: liderados com despesas que vencem neste mês
 * e ainda não estão num relatório enviado (sem relatório, relatório aberto ou devolvidas).
 */
export async function teamAlerts(db: DbLike, leaderId: number, at: Date): Promise<TeamAlert[]> {
  if (!inAlertWindow(at)) return [];
  const team = (await teamOf(db, leaderId)).filter((p) => p.active);
  if (!team.length) return [];
  const { y, m } = brtMonth(at);
  const monthEnd = new Date(Date.UTC(y, m + 1, 1, 2, 59, 59)).getTime();
  const rows = await listAdminExpenses(db as Db, { ownerIds: team.map((p) => p.id) });
  const byPerson = new Map<number, TeamAlert>();
  for (const r of rows) {
    if (!["sem_relatorio", "em_relatorio", "devolvida"].includes(r.status)) continue;
    const due = new Date(r.e.dueAt).getTime();
    if (due <= at.getTime() || due > monthEnd || !r.owner) continue;
    const alert = byPerson.get(r.owner.id) ?? { person: { id: r.owner.id, name: r.owner.name }, count: 0, totalCents: 0 };
    alert.count += 1;
    alert.totalCents += r.e.amountCents;
    byPerson.set(r.owner.id, alert);
  }
  return [...byPerson.values()].sort((a, b) => b.totalCents - a.totalCents);
}

export interface SpendingLine {
  key: string;
  label: string;
  count: number;
  totalCents: number;
}

export interface TeamSpending {
  month: string;
  totalCents: number;
  count: number;
  byPerson: SpendingLine[];
  byCategory: SpendingLine[];
  byStatus: SpendingLine[];
  rows: ExpenseRow[];
}

function group(rows: ExpenseRow[], keyOf: (r: ExpenseRow) => [string, string]): SpendingLine[] {
  const map = new Map<string, SpendingLine>();
  for (const r of rows) {
    const [key, label] = keyOf(r);
    const line = map.get(key) ?? { key, label, count: 0, totalCents: 0 };
    line.count += 1;
    line.totalCents += r.e.amountCents;
    map.set(key, line);
  }
  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/** Gastos dos liderados num mês (AAAA-MM), pela data da compra. Estornos ficam de fora. */
export async function teamSpending(db: DbLike, leaderId: number, month: string): Promise<TeamSpending> {
  const team = await teamOf(db, leaderId);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = team.length
    ? (await listAdminExpenses(db as Db, { ownerIds: team.map((p) => p.id), from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` })).filter(
        (r) => r.e.kind !== "estorno",
      )
    : [];
  const STATUS = { sem_relatorio: "Sem relatório", em_relatorio: "Em relatório", em_aprovacao: "Em aprovação", aprovada: "Aprovadas", devolvida: "Devolvidas", ignorada: "Ignoradas", estorno: "Estornos" };
  return {
    month,
    totalCents: rows.reduce((s, r) => s + r.e.amountCents, 0),
    count: rows.length,
    byPerson: group(rows, (r) => [String(r.owner?.id ?? 0), r.owner?.name ?? "Sem dono"]),
    byCategory: group(rows, (r) => [String(r.category?.id ?? 0), r.category?.name ?? "Tipo não informado"]),
    byStatus: group(rows, (r) => [r.status, STATUS[r.status]]),
    rows,
  };
}

/** Meses (AAAA-MM) com compras dos liderados, do mais recente ao mais antigo. */
export async function teamMonths(db: DbLike, leaderId: number): Promise<string[]> {
  const team = await teamOf(db, leaderId);
  if (!team.length) return [];
  const rows = await db
    .selectDistinct({ month: sql<string>`substr(${expenses.purchaseDate}, 1, 7)` })
    .from(expenses)
    .where(and(inArray(expenses.employeeId, team.map((p) => p.id))))
    .all();
  return rows.map((r) => r.month).filter(Boolean).sort().reverse();
}

/** Quantos relatórios esperam a decisão deste revisor. */
export async function pendingApprovals(db: DbLike, reviewer: Pick<Employee, "id" | "role">): Promise<number> {
  const conditions = [eq(reports.status, "enviado")];
  if (reviewer.role !== "admin") {
    conditions.push(inArray(reports.employeeId, db.select({ id: employees.id }).from(employees).where(eq(employees.leaderId, reviewer.id))));
  }
  const row = await db.select({ n: sql<number>`count(*)` }).from(reports).where(and(...conditions)).get();
  return Number(row?.n ?? 0);
}
