import crypto from "node:crypto";
import { prisma } from "./db";

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const token = crypto.randomBytes(24).toString("hex");
  const rawKey = `br_live_${token}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);
  return { rawKey, keyHash, keyPrefix };
}

export async function verifyApiKey(rawKey: string, requiredScope?: string) {
  if (!rawKey || !rawKey.startsWith("br_live_")) {
    return { valid: false, error: "Format API key tidak valid", status: 401 };
  }

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { project: true, createdBy: true },
  });

  if (!apiKey) {
    return { valid: false, error: "API key tidak ditemukan", status: 401 };
  }

  if (apiKey.revokedAt) {
    return { valid: false, error: "API key telah dicabut (revoked)", status: 401 };
  }

  if (apiKey.project.isArchived) {
    return { valid: false, error: "Project telah diarsipkan", status: 403 };
  }

  if (requiredScope && !apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes("*")) {
    return { valid: false, error: `Scope '${requiredScope}' tidak diizinkan untuk key ini`, status: 403 };
  }

  // Rate limiter: max 30 calls / minute per key
  const now = new Date();
  const windowSlot = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0
  );

  const rateLimit = await prisma.apiKeyRateLimit.upsert({
    where: {
      keyHash_windowSlot: {
        keyHash,
        windowSlot,
      },
    },
    create: {
      keyHash,
      windowSlot,
      callCount: 1,
    },
    update: {
      callCount: { increment: 1 },
    },
  });

  if (rateLimit.callCount > 30) {
    return { valid: false, error: "Rate limit terlampaui (maksimal 30 request per menit)", status: 429 };
  }

  // Record lastUsedAt non-blocking
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return { valid: true, apiKey, project: apiKey.project };
}
