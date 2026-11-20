export type ImportedCase = { name: string; code: string | null; result: "PASS" | "FAIL" | "SKIPPED"; actualResult?: string; skippedReason?: string };

const decode = (value: string) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const attr = (tag: string, name: string) => decode(tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"))?.[1] ?? "");

export function parseJUnit(xml: string): ImportedCase[] {
  if (!xml.trim()) throw new Error("JUnit XML kosong.");
  const cases: ImportedCase[] = [];
  for (const match of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase\s*>)/gi)) {
    const tag = match[1];
    const body = match[2] ?? "";
    const name = attr(tag, "name").trim();
    const code = name.match(/\b([A-Z][A-Z0-9_]*(?:-[A-Z0-9_]+)*-\d+)\b/i)?.[1]?.toUpperCase() ?? null;
    const skipped = body.match(/<skipped\b([^>]*)\/?>(?:<\/skipped>)?/i);
    const failure = body.match(/<(?:failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:failure|error)>)/i);
    cases.push({ name, code, result: skipped ? "SKIPPED" : failure ? "FAIL" : "PASS", ...(failure ? { actualResult: (failure[2]?.replace(/<[^>]+>/g, "").trim() || attr(failure[1], "message") || "JUnit failure") } : {}), ...(skipped ? { skippedReason: attr(skipped[1], "message") || "JUnit skipped" } : {}) });
  }
  if (!cases.length) throw new Error("JUnit XML tidak memiliki testcase.");
  return cases;
}
