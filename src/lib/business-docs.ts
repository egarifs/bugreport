import fs from "node:fs/promises";
import path from "node:path";

// storedPath is absolute and differs per host (/app/uploads vs ~/lab/...). Resolve from basename only:
// portable across moves and immune to path traversal.
export function docFilePath(projectKey: string, storedPath: string) {
  return path.join(process.cwd(), "uploads", projectKey, "docs", path.basename(storedPath));
}

export const isMarkdown = (fileName: string) => fileName.toLowerCase().endsWith(".md");

export async function readDocText(projectKey: string, v: { storedPath: string; fileName: string }) {
  if (!isMarkdown(v.fileName)) return null; // ponytail: PDF text not extracted; add pdf parsing when PDFs need chat search.
  return fs.readFile(docFilePath(projectKey, v.storedPath), "utf8").catch(() => null);
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
