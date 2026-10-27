import * as XLSX from "xlsx";
import { TestCasePriority } from "@prisma/client";

export interface ParsedSheetTestCase {
  code: string;
  moduleArea: string;
  title: string;
  priority: TestCasePriority;
  testType: string;
  targetRole: string;
  precondition: string;
  steps: string;
  expectedResult: string;
  referenceUrl: string;
}

function normalizePriority(p?: string): TestCasePriority {
  const clean = (p || "").trim().toUpperCase();
  if (clean.includes("CRIT") || clean.includes("P0")) return TestCasePriority.CRITICAL;
  if (clean.includes("HIGH") || clean.includes("P1")) return TestCasePriority.HIGH;
  if (clean.includes("LOW") || clean.includes("P3")) return TestCasePriority.LOW;
  return TestCasePriority.MEDIUM;
}

export function parseTestCaseWorkbook(buffer: Buffer): ParsedSheetTestCase[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const results: ParsedSheetTestCase[] = [];

  // Pick sheet matching TC_* or first sheet if none match
  const tcSheetName = wb.SheetNames.find((name) => name.toUpperCase().startsWith("TC_")) || wb.SheetNames[0];
  if (!tcSheetName) return [];

  const ws = wb.Sheets[tcSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  let rowCounter = 1;
  for (const row of rawRows) {
    // Map Indonesian CRM template headers and generic English headers
    const code = String(row["ID"] || row["Code"] || row["id"] || `TC-${rowCounter}`).trim();
    const title = String(row["Judul Testcase"] || row["Title"] || row["Judul"] || "").trim();
    if (!title) continue;

    const moduleArea = String(row["Area"] || row["Module"] || row["Modul"] || "").trim();
    const priority = normalizePriority(String(row["Prioritas"] || row["Priority"] || ""));
    const testType = String(row["Tipe"] || row["Type"] || "").trim();
    const targetRole = String(row["Role"] || row["Target Role"] || "").trim();
    const precondition = String(row["Prasyarat"] || row["Precondition"] || "").trim();
    const steps = String(row["Langkah"] || row["Steps"] || row["Langkah Pengujian"] || "").trim();
    const expectedResult = String(row["Expected Result"] || row["Ekspektasi"] || "").trim();
    const referenceUrl = String(row["Referensi Figma"] || row["Reference"] || row["Figma"] || "").trim();

    results.push({
      code,
      moduleArea,
      title,
      priority,
      testType,
      targetRole,
      precondition,
      steps,
      expectedResult,
      referenceUrl,
    });
    rowCounter++;
  }

  return results;
}
