// Validation for user-supplied bug links and screenshots (trust boundary: server actions).

export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_MAX_COUNT = 5;
export const LINKS_MAX = 10;

// Only http(s); blocks javascript:, data:, etc. Returns null for empty, throws message for invalid.
export function parseUrl(raw: unknown, label: string): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error(`${label} bukan URL valid.`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`${label} harus diawali http:// atau https://.`);
  return u.toString();
}

export function parseLinks(raw: unknown): string[] {
  const lines = String(raw ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > LINKS_MAX) throw new Error(`Maksimal ${LINKS_MAX} tautan lain.`);
  return [...new Set(lines.map((l) => parseUrl(l, `Tautan "${l.slice(0, 40)}"`)!))];
}

// "CRM-1, crm-4 CRM-1" -> ["CRM-1", "CRM-4"]
export function parseBugKeys(raw: unknown): string[] {
  const parts = String(raw ?? "").toUpperCase().split(/[\s,;]+/).filter(Boolean);
  const bad = parts.find((p) => !/^[A-Z0-9]{1,6}-\d+$/.test(p));
  if (bad) throw new Error(`"${bad}" bukan ID bug (contoh: CRM-12).`);
  return [...new Set(parts)];
}

// Type from magic bytes, not the client-supplied MIME. SVG deliberately excluded (can carry script).
export function sniffImage(buf: Uint8Array): { mime: string; ext: string } | null {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  if (String.fromCharCode(...buf.slice(0, 4)) === "GIF8") return { mime: "image/gif", ext: "gif" };
  return null;
}

export type Screenshot = { name: string; bytes: Buffer; mime: string; ext: string };

export async function readScreenshots(files: FormDataEntryValue[]): Promise<Screenshot[]> {
  const real = files.filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (real.length > SCREENSHOT_MAX_COUNT) throw new Error(`Maksimal ${SCREENSHOT_MAX_COUNT} screenshot.`);
  const out: Screenshot[] = [];
  for (const f of real) {
    if (f.size > SCREENSHOT_MAX_BYTES) throw new Error(`${f.name} melebihi 5 MB.`);
    const bytes = Buffer.from(await f.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) throw new Error(`${f.name} bukan gambar PNG, JPG, WEBP, atau GIF.`);
    out.push({ name: f.name.replace(/[^\w.\- ]/g, "_").slice(0, 120), bytes, ...kind });
  }
  return out;
}
