"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ExpenseError } from "@/lib/expenses";
import { deletePerson, reactivatePerson, savePerson, terminatePerson, type Role } from "@/lib/people";

export type PersonFormState = { error: string } | null;

const ROLES: Role[] = ["funcionario", "aprovador", "admin"];

function ints(form: FormData, name: string): number[] {
  return form.getAll(name).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

export async function savePersonAction(_: PersonFormState, form: FormData): Promise<PersonFormState> {
  await requireAdmin();
  const id = Number(form.get("id")) || null;
  const role = String(form.get("role")) as Role;
  let savedId: number;
  try {
    savedId = await savePerson(await getDb(), id, {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "") || undefined,
      role: ROLES.includes(role) ? role : "funcionario",
      costCenter: String(form.get("costCenter") ?? ""),
      cardHolderName: String(form.get("cardHolderName") ?? ""),
      leaderId: Number(form.get("leaderId")) || null,
      cardIds: ints(form, "cardIds"),
      teamIds: ints(form, "teamIds"),
    });
  } catch (error) {
    if (error instanceof ExpenseError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(`/admin/cadastro/${savedId}?salvo=1`);
}

export async function terminateAction(_: PersonFormState, form: FormData): Promise<PersonFormState> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (id === admin.id) return { error: "Você não pode desligar o seu próprio usuário." };
  try {
    await terminatePerson(await getDb(), id, String(form.get("date") ?? ""));
  } catch (error) {
    if (error instanceof ExpenseError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(`/admin/cadastro/${id}`);
}

export async function reactivateAction(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get("id"));
  await reactivatePerson(await getDb(), id);
  revalidatePath("/", "layout");
  redirect(`/admin/cadastro/${id}`);
}

export async function deleteAction(_: PersonFormState, form: FormData): Promise<PersonFormState> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (id === admin.id) return { error: "Você não pode excluir o seu próprio usuário." };
  try {
    await deletePerson(await getDb(), id);
  } catch (error) {
    if (error instanceof ExpenseError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/admin/cadastro");
}
