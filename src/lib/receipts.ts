import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "@/db";

const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export const RECEIPTS_DIR = path.join(DATA_DIR, "receipts");

export async function saveReceipt(file: File, transactionId: number): Promise<{ path: string; mime: string }> {
  const ext = EXTENSIONS[file.type];
  if (!ext) throw new Error("Envie uma foto (JPG, PNG, WEBP, HEIC) ou PDF do comprovante.");
  if (file.size > MAX_BYTES) throw new Error("O comprovante deve ter no máximo 8 MB.");
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });
  const name = `${transactionId}-${randomBytes(6).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(RECEIPTS_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { path: name, mime: file.type };
}

export async function readReceipt(name: string): Promise<Buffer> {
  // nome gerado pelo servidor; basename impede sair da pasta
  return fs.readFile(path.join(RECEIPTS_DIR, path.basename(name)));
}
