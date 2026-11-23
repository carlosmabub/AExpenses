import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { PageTitle } from "@/components/page-title";
import { formData } from "../data";
import { PersonForm } from "../person-form";

export default async function NewPersonPage() {
  const data = await formData(await getDb(), null);
  return (
    <>
      <Link href="/admin/cadastro" className="link mb-2 inline-flex min-h-10 items-center gap-1 font-display text-sm lowercase text-muted"><ChevronLeft size={16} aria-hidden="true" /> usuários</Link>
      <PageTitle title="novo usuário" />
      <PersonForm {...data} />
    </>
  );
}
