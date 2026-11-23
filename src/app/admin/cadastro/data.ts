import { asc } from "drizzle-orm";
import type { Db } from "@/db";
import { cards } from "@/db/schema";
import { isApprover, listPeople } from "@/lib/people";
import type { PersonFormProps } from "./person-form";

/** Listas que o formulário de cadastro precisa (líderes, cartões, possíveis liderados, centros de custo). */
export async function formData(db: Db, personId: number | null): Promise<Pick<PersonFormProps, "leaders" | "cards" | "candidates" | "costCenters">> {
  const [people, allCards] = await Promise.all([listPeople(db), db.select().from(cards).orderBy(asc(cards.holderName)).all()]);
  const active = people.filter((p) => p.active);
  const byId = new Map(people.map((p) => [p.id, p]));
  return {
    leaders: active.filter((p) => isApprover(p) && p.id !== personId).map((p) => ({ id: p.id, name: p.name })),
    cards: allCards
      .filter((c) => !c.isBillingAccount && personId !== null && c.employeeId === personId)
      .map((c) => ({ id: c.id, label: `final ${c.last4}${c.fingerprint.startsWith("pending:") ? ", aguardando o arquivo do banco" : ""}`, checked: true })),
    candidates: active
      .filter((p) => p.id !== personId)
      .map((p) => ({ id: p.id, name: p.name, checked: personId !== null && p.leaderId === personId, leaderName: p.leaderId ? (byId.get(p.leaderId)?.name ?? null) : null })),
    costCenters: [...new Set(people.map((p) => p.costCenter).filter(Boolean))].sort(),
  };
}
