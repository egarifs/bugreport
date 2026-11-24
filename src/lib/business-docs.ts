import fs from "node:fs/promises";
import path from "node:path";
import { extractText } from "unpdf";

// storedPath is absolute and differs per host (/app/uploads vs ~/lab/...). Resolve from basename only:
// portable across moves and immune to path traversal.
export function docFilePath(projectKey: string, storedPath: string) {
  return path.join(process.cwd(), "uploads", projectKey, "docs", path.basename(storedPath));
}

export const isMarkdown = (fileName: string) => fileName.toLowerCase().endsWith(".md");
export const isPdf = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");

const PDF_MAX_PAGES = 50;
const PDF_PARSE_TIMEOUT_MS = 6000;

export async function readDocText(projectKey: string, v: { storedPath: string; fileName: string }): Promise<string | null> {
  const filePath = docFilePath(projectKey, v.storedPath);

  if (isMarkdown(v.fileName)) {
    return fs.readFile(filePath, "utf8").catch(() => null);
  }

  if (isPdf(v.fileName)) {
    try {
      const buffer = await fs.readFile(filePath);
      // Validasi PDF signature (%PDF-)
      if (buffer.length < 5 || buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
        return null;
      }

      // Hardening: Timeout guard cegah thread loop/DoS
      const parsePromise = extractText(new Uint8Array(buffer));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PDF extraction timeout")), PDF_PARSE_TIMEOUT_MS)
      );

      const res = await Promise.race([parsePromise, timeoutPromise]);
      let pages = Array.isArray(res.text) ? res.text : [String(res.text || "")];
      // Hardening: Batasi maksimal halaman yang diproses
      if (pages.length > PDF_MAX_PAGES) {
        pages = pages.slice(0, PDF_MAX_PAGES);
      }

      const extracted = pages.join("\n\n").trim();
      return extracted || null;
    } catch {
      return null;
    }
  }

  return null;
}

export interface Section {
  heading: string;
  text: string;
}

// Split markdown into heading-led sections, long ones cut to ~maxLen.
export function splitSections(md: string, maxLen = 3000): Section[] {
  const out: Section[] = [];
  let heading = "(awal dokumen)";
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    for (let i = 0; i < text.length; i += maxLen) out.push({ heading, text: text.slice(i, i + maxLen) });
    buf = [];
  };
  for (const line of md.split("\n")) {
    const h = /^#{1,4}\s+(.*)/.exec(line);
    if (h) {
      flush();
      heading = h[1].trim();
    }
    buf.push(line);
  }
  flush();
  return out;
}

const STOP = new Set(["dan", "yang", "di", "ke", "dari", "untuk", "apa", "apakah", "tentang", "jelaskan", "itu", "ini", "the", "of", "and"]);

// Keyword ranking: heading hits weigh more. ponytail: no stemming/FTS; move to BusinessDocChunk + tsvector when docs get large.
export function rankSections(sections: Section[], query: string, limit = 5) {
  const terms = [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1 && !STOP.has(t)))];
  if (!terms.length) return [];
  return sections
    .map((s) => {
      const h = s.heading.toLowerCase();
      const t = s.text.toLowerCase();
      const score = terms.reduce((n, term) => n + (h.includes(term) ? 3 : 0) + (t.includes(term) ? 1 : 0), 0);
      return { ...s, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
