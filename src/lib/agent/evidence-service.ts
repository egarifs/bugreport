import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { MAX_EVIDENCE_BYTES, evidencePath, err, ownSession } from "./shared";
import type { AgentCtx } from "./shared";

const EVIDENCE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", webm: "video/webm", mp4: "video/mp4", txt: "text/plain", log: "text/plain" };

export async function uploadEvidence(ctx: AgentCtx, a: { fileName?: string; dataBase64?: string; sessionId?: string }) {
  const ext = String(a.fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  const mimeType = EVIDENCE_TYPES[ext];
  if (!mimeType) return err(`Tipe file tidak didukung. Boleh: ${Object.keys(EVIDENCE_TYPES).join(", ")}.`);
  if (!a.dataBase64) return err("dataBase64 wajib diisi.");
  if (a.sessionId && !(await ownSession(ctx, a.sessionId))) return err("Sesi tidak ditemukan atau bukan milik key ini.");
  const buf = Buffer.from(String(a.dataBase64).replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buf.length) return err("File kosong.");
  if (buf.length > MAX_EVIDENCE_BYTES) return err("Ukuran file melebihi 10 MB. Unggah ke tempat lain dan kirim link lewat 'links'.");
  const fileName = String(a.fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const id = randomUUID();
  const storedName = `${id}_${fileName}`;
  const file = evidencePath(ctx.projectKey, storedName);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
  await prisma.evidence.create({ data: { id, projectId: ctx.projectId, uploadedById: ctx.actorId, sessionId: a.sessionId || null, fileName, storedName, mimeType, fileSize: buf.length } });
  return { ok: true as const, evidenceId: id, fileName, fileSize: buf.length };
}

// Passing item = proof no longer needed: delete files of every attempt of the item (rows stay, purgedAt set).
export async function purgeItemEvidence(projectKey: string, itemId: string) {
  const rows = await prisma.evidence.findMany({ where: { purgedAt: null, attempt: { itemId } } });
  for (const e of rows) await fs.rm(evidencePath(projectKey, e.storedName), { force: true });
  if (rows.length) await prisma.evidence.updateMany({ where: { id: { in: rows.map((e) => e.id) } }, data: { purgedAt: new Date() } });
  return rows.length;
}
