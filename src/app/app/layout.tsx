import { requireUser } from "@/lib/auth";
import { BottomNav } from "./bottom-nav";

export const dynamic = "force-dynamic";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-paper px-4 pb-32">
      <main id="main">{children}</main>
      <BottomNav />
    </div>
  );
}
