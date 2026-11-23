import type { Db } from "./index";
import { categories, employees } from "./schema";
import { DEFAULT_CATEGORIES } from "@/lib/mcc";
import { hashPassword } from "@/lib/password";

/** Funcionários de demonstração, ligados aos portadores do arquivo de exemplo do Bradesco. */
export const DEMO_EMPLOYEES = [
  { name: "Ana Souza", costCenter: "6270", holder: "NOME DO PORTADOR 01" },
  { name: "Bruno Lima", costCenter: "40673", holder: "NOME DO PORTADOR 02" },
  { name: "Carla Mendes", costCenter: "6564", holder: "NOME DO PORTADOR 03" },
  { name: "Diego Rocha", costCenter: "4383", holder: "NOME DO PORTADOR 04" },
  { name: "Elisa Martins", costCenter: "3751", holder: "NOME DO PORTADOR 05" },
  { name: "Felipe Costa", costCenter: "6734", holder: "NOME DO PORTADOR 06" },
  { name: "Gabriela Alves", costCenter: "22365", holder: "NOME DO PORTADOR 07" },
  { name: "Henrique Dias", costCenter: "6823", holder: "NOME DO PORTADOR 08" },
  // Portador 09 fica sem cadastro de propósito: mostra a fila de "cartões não vinculados"
];

/** Usuário da apresentação do piloto: recebe todos os gastos do arquivo de exemplo num cartão só. */
export const PILOT_USER = { name: "Carlos", email: "carlos@empresa.com.br", costCenter: "4383", holder: "CARLOS" };

export const DEMO_ADMIN = { name: "Financeiro", email: "financeiro@empresa.com.br", password: "admin123" };
export const DEMO_EMPLOYEE_PASSWORD = "123456";

function emailFor(name: string): string {
  const [first, last] = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(" ");
  return `${first}.${last}@empresa.com.br`;
}

export async function seedCategories(db: Db): Promise<void> {
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
    .onConflictDoNothing()
    .run();
}

export async function seedIfEmpty(db: Db): Promise<void> {
  if ((await db.select().from(employees).limit(1).all()).length > 0) return;
  await seedCategories(db);
  await db.insert(employees)
    .values({ name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, passwordHash: hashPassword(DEMO_ADMIN.password), role: "admin" })
    .onConflictDoNothing()
    .run();
  const employeeHash = hashPassword(DEMO_EMPLOYEE_PASSWORD);
  await db
    .insert(employees)
    .values(DEMO_EMPLOYEES.map((e) => ({ name: e.name, email: emailFor(e.name), passwordHash: employeeHash, costCenter: e.costCenter, cardHolderName: e.holder })))
    .onConflictDoNothing()
    .run();
}

/** Garante os usuários do piloto também num banco que já tinha seed (ex.: o Turso da Vercel). */
export async function ensureDemoUsers(db: Db): Promise<void> {
  await db
    .insert(employees)
    .values({
      name: PILOT_USER.name,
      email: PILOT_USER.email,
      passwordHash: hashPassword(DEMO_EMPLOYEE_PASSWORD),
      costCenter: PILOT_USER.costCenter,
      cardHolderName: PILOT_USER.holder,
    })
    .onConflictDoNothing()
    .run();
}
