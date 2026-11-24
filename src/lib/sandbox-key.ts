import { createHash } from "node:crypto";

/** Kode project Latihan deterministik per pengguna: LAT + 6 hex. Satu per pengguna. */
export function sandboxKeyFor(userId: string): string {
  return `LAT${createHash("sha1").update(userId).digest("hex").slice(0, 6).toUpperCase()}`;
}

