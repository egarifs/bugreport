// F9: a test case is agent-ready when it is READY, every {{placeholder}} has data, and nothing secret is stored.
const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;
const SECRET_KEY = /pass(word|wd)?|token|secret/i;

export type ReadinessInput = { status: string; steps: string; precondition?: string | null; expectedResult: string; testData?: unknown };

export function agentReadiness(tc: ReadinessInput): { ready: boolean; missing: string[] } {
  const data = tc.testData && typeof tc.testData === "object" && !Array.isArray(tc.testData) ? (tc.testData as Record<string, unknown>) : {};
  const missing: string[] = [];
  if (tc.status !== "READY") missing.push("status harus Siap (READY)");
  if (!tc.expectedResult.trim()) missing.push("hasil yang diharapkan kosong");
  const used = new Set([...`${tc.steps}\n${tc.precondition ?? ""}`.matchAll(PLACEHOLDER)].map((m) => m[1]));
  for (const k of used) if (!(k in data)) missing.push(`data uji "${k}" belum diisi`);
  for (const k of Object.keys(data)) if (SECRET_KEY.test(k)) missing.push(`data uji "${k}" tampak kredensial; simpan di sumber akun uji`);
  return { ready: missing.length === 0, missing };
}

// Fills {{name}} from testData; unknown placeholders stay as written.
export function fillTestData(text: string, testData: unknown): string {
  const data = testData && typeof testData === "object" && !Array.isArray(testData) ? (testData as Record<string, unknown>) : {};
  return text.replace(PLACEHOLDER, (m, k) => (k in data ? String(data[k]) : m));
}
