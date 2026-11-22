import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { DATA_DIR } from "@/db";

const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

const RECEIPTS_DIR = path.join(DATA_DIR, "receipts");
/** Comprovantes guardados no Vercel Blob começam com este prefixo; os demais estão no disco (dev local). */
const BLOB_PREFIX = "blob:";

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function saveReceipt(file: File, transactionId: number): Promise<{ path: string; mime: string }> {
  const ext = EXTENSIONS[file.type];
  if (!ext) throw new Error("Envie uma foto (JPG, PNG, WEBP, HEIC) ou PDF do comprovante.");
  if (file.size > MAX_BYTES) throw new Error("O comprovante deve ter no máximo 8 MB.");
  const name = `${transactionId}-${randomBytes(6).toString("hex")}.${ext}`;

  if (useBlob()) {
    // Privado: só é lido pelo servidor, que confere se quem pede é o dono ou o financeiro
    const blob = await put(`receipts/${name}`, file, { access: "private", contentType: file.type, addRandomSuffix: false });
    return { path: BLOB_PREFIX + blob.pathname, mime: file.type };
  }
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });
  await fs.writeFile(path.join(RECEIPTS_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { path: name, mime: file.type };
}

export async function readReceipt(stored: string): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  if (stored.startsWith(BLOB_PREFIX)) {
    const result = await get(stored.slice(BLOB_PREFIX.length), { access: "private" });
    return result?.statusCode === 200 ? result.stream : null;
  }
  // nome gerado pelo servidor; basename impede sair da pasta
  return fs.readFile(path.join(RECEIPTS_DIR, path.basename(stored))).catch(() => null);
}
