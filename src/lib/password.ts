import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";

const KEYLEN = 64;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
export const MIN_PASSWORD = 10;

const derive = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, KEYLEN, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await derive(pw, salt)).toString("hex")}`;
}

export async function verifyHash(pw: string, stored: string | null) {
  // Selalu hitung scrypt, juga saat user tidak ada, agar waktu respons tidak membocorkan akun.
  const [, saltHex, hashHex] = (stored ?? "scrypt$00$00").split("$");
  const expected = Buffer.from(hashHex, "hex");
  const got = await derive(pw, Buffer.from(saltHex, "hex"));
  return !!stored && expected.length === got.length && timingSafeEqual(expected, got);
}

/** Cek email+kata sandi. Hanya user ACTIVE; kunci 15 menit setelah 5 kali gagal. Null bila gagal. */
export async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const locked = !!user?.lockedUntil && user.lockedUntil > new Date();
  const ok = await verifyHash(password, locked ? null : user?.passwordHash ?? null);
  if (!user || locked) return null;
  if (!ok || user.status !== "ACTIVE") {
    if (user.passwordHash && !ok) {
      const fails = user.failedLogins + 1;
      await prisma.user.update({ where: { id: user.id }, data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLogins: fails } });
    }
    return null;
  }
  if (user.failedLogins || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  return user;
}
