import { TestCasePriority, BugSeverity } from "@prisma/client";
import type { ParsedSheetTestCase } from "./testcase-importer";

function normalizePriority(p?: string): TestCasePriority {
  const clean = (p || "").trim().toUpperCase();
  if (clean.includes("CRIT") || clean.includes("P0")) return TestCasePriority.CRITICAL;
  if (clean.includes("HIGH") || clean.includes("P1")) return TestCasePriority.HIGH;
  if (clean.includes("LOW") || clean.includes("P3")) return TestCasePriority.LOW;
  return TestCasePriority.MEDIUM;
}

function normalizeSeverity(s?: string): BugSeverity {
  const clean = (s || "").trim().toUpperCase();
  if (clean.includes("CRIT") || clean.includes("BLOCK")) return BugSeverity.BLOCKER;
  if (clean.includes("HIGH")) return BugSeverity.HIGH;
  if (clean.includes("LOW")) return BugSeverity.LOW;
  return BugSeverity.MEDIUM;
}

/**
 * Parses markdown table or section format into Test Cases.
 * Expected markdown table format:
 * | Code | Judul | Modul | Prioritas | Tipe | Langkah | Ekspektasi |
 */
export function parseMarkdownTestCases(mdContent: string): ParsedSheetTestCase[] {
  const lines = mdContent.split(/\r?\n/).map((l) => l.trim());
  const results: ParsedSheetTestCase[] = [];

  // 1. Check if markdown table exists
  const tableRows = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (tableRows.length >= 3) {
    // Row 0 is header, Row 1 is divider
    const headerCols = tableRows[0]
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim().toLowerCase());

    const colIndex = {
      code: headerCols.findIndex((c) => c.includes("code") || c.includes("id")),
      title: headerCols.findIndex((c) => c.includes("judul") || c.includes("title")),
      module: headerCols.findIndex((c) => c.includes("modul") || c.includes("area")),
      priority: headerCols.findIndex((c) => c.includes("prioritas") || c.includes("priority")),
      type: headerCols.findIndex((c) => c.includes("tipe") || c.includes("type")),
      steps: headerCols.findIndex((c) => c.includes("langkah") || c.includes("step")),
      expected: headerCols.findIndex((c) => c.includes("ekspektasi") || c.includes("expected")),
    };

    // If title column is found, parse rows
    if (colIndex.title !== -1) {
      let counter = 1;
      for (let i = 2; i < tableRows.length; i++) {
        const cols = tableRows[i]
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim().replace(/\\\|/g, "|"));

        const title = cols[colIndex.title] || "";
        if (!title) continue;

        const code = colIndex.code !== -1 && cols[colIndex.code] ? cols[colIndex.code] : `TC-${counter}`;
        const moduleArea = colIndex.module !== -1 ? cols[colIndex.module] : "";
        const priority = colIndex.priority !== -1 ? normalizePriority(cols[colIndex.priority]) : TestCasePriority.MEDIUM;
        const testType = colIndex.type !== -1 && cols[colIndex.type] ? cols[colIndex.type] : "Functional";
        const steps = colIndex.steps !== -1 && cols[colIndex.steps] ? cols[colIndex.steps] : "-";
        const expectedResult = colIndex.expected !== -1 && cols[colIndex.expected] ? cols[colIndex.expected] : "-";

        results.push({
          code,
          title,
          moduleArea,
          priority,
          testType,
          targetRole: "ALL",
          precondition: "-",
          steps,
          expectedResult,
          referenceUrl: "",
        });
        counter++;
      }
      if (results.length > 0) return results;
    }
  }

  // 2. Fallback: Parse Markdown Heading Section items (## TC: [Title] ...)
  let currentTC: Partial<ParsedSheetTestCase> | null = null;
  let counter = 1;

  for (const line of lines) {
    if (line.match(/^#{2,3}\s+(?:TC|Test Case|Testcase)?\s*(.*)/i)) {
      if (currentTC?.title) {
        results.push(currentTC as ParsedSheetTestCase);
      }
      const rawTitle = line.replace(/^#{2,3}\s+/, "").replace(/^(?:TC|Test Case|Testcase):\s*/i, "").trim();
      currentTC = {
        code: `TC-${counter++}`,
        title: rawTitle,
        moduleArea: "",
        priority: TestCasePriority.MEDIUM,
        testType: "Functional",
        targetRole: "ALL",
        precondition: "-",
        steps: "",
        expectedResult: "",
        referenceUrl: "",
      };
    } else if (currentTC) {
      if (line.match(/^\s*[-*]\s*\*\*(?:Langkah|Steps?)\*\*:\s*(.*)/i)) {
        currentTC.steps = line.replace(/^\s*[-*]\s*\*\*(?:Langkah|Steps?)\*\*:\s*/i, "").trim();
      } else if (line.match(/^\s*[-*]\s*\*\*(?:Ekspektasi|Expected)\*\*:\s*(.*)/i)) {
        currentTC.expectedResult = line.replace(/^\s*[-*]\s*\*\*(?:Ekspektasi|Expected)\*\*:\s*/i, "").trim();
      } else if (line.match(/^\s*[-*]\s*\*\*(?:Modul|Module|Area)\*\*:\s*(.*)/i)) {
        currentTC.moduleArea = line.replace(/^\s*[-*]\s*\*\*(?:Modul|Module|Area)\*\*:\s*/i, "").trim();
      } else if (line.match(/^\s*[-*]\s*\*\*(?:Prioritas|Priority)\*\*:\s*(.*)/i)) {
        currentTC.priority = normalizePriority(line.replace(/^\s*[-*]\s*\*\*(?:Prioritas|Priority)\*\*:\s*/i, ""));
      } else if (line.match(/^\s*[-*]\s*\*\*(?:Tipe|Type)\*\*:\s*(.*)/i)) {
        currentTC.testType = line.replace(/^\s*[-*]\s*\*\*(?:Tipe|Type)\*\*:\s*/i, "").trim();
      }
    }
  }

  if (currentTC?.title) {
    results.push(currentTC as ParsedSheetTestCase);
  }

  return results;
}

export interface ParsedMarkdownBug {
  title: string;
  moduleArea?: string;
  severity: BugSeverity;
  stepsToReproduce: string;
  expectedResult?: string;
  actualResult?: string;
}

/**
 * Parses markdown into list of bugs.
 * Supports:
 * 1. Table format: | Judul | Modul | Severity | Langkah | Aktual | Ekspektasi |
 * 2. Section format: ## Bug: [Judul] with bullet metadata
 */
export function parseMarkdownBugs(mdContent: string): ParsedMarkdownBug[] {
  const lines = mdContent.split(/\r?\n/).map((l) => l.trim());
  const results: ParsedMarkdownBug[] = [];

  // 1. Table format
  const tableRows = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (tableRows.length >= 3) {
    const headerCols = tableRows[0]
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim().toLowerCase());

    const colIndex = {
      title: headerCols.findIndex((c) => c.includes("judul") || c.includes("title") || c.includes("bug")),
      module: headerCols.findIndex((c) => c.includes("modul") || c.includes("area")),
      severity: headerCols.findIndex((c) => c.includes("severity") || c.includes("keparahan")),
      steps: headerCols.findIndex((c) => c.includes("langkah") || c.includes("step")),
      actual: headerCols.findIndex((c) => c.includes("aktual") || c.includes("actual")),
      expected: headerCols.findIndex((c) => c.includes("ekspektasi") || c.includes("expected")),
    };

    if (colIndex.title !== -1) {
      for (let i = 2; i < tableRows.length; i++) {
        const cols = tableRows[i]
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim().replace(/\\\|/g, "|"));

        const title = cols[colIndex.title] || "";
        if (!title) continue;

        results.push({
          title,
          moduleArea: colIndex.module !== -1 ? cols[colIndex.module] : undefined,
          severity: colIndex.severity !== -1 ? normalizeSeverity(cols[colIndex.severity]) : BugSeverity.MEDIUM,
          stepsToReproduce: colIndex.steps !== -1 && cols[colIndex.steps] ? cols[colIndex.steps] : "-",
          actualResult: colIndex.actual !== -1 ? cols[colIndex.actual] : undefined,
          expectedResult: colIndex.expected !== -1 ? cols[colIndex.expected] : undefined,
        });
      }
      if (results.length > 0) return results;
    }
  }

  // 2. Heading Section format (## Bug: [Judul])
  let currentBug: Partial<ParsedMarkdownBug> | null = null;

  for (const line of lines) {
    if (line.match(/^#{2,3}\s+(?:Bug|Defect|Issue)?\s*(.*)/i)) {
      if (currentBug?.title) {
        results.push(currentBug as ParsedMarkdownBug);
      }
      const rawTitle = line.replace(/^#{2,3}\s+/, "").replace(/^(?:Bug|Defect|Issue):\s*/i, "").trim();
      currentBug = {
        title: rawTitle,
        severity: BugSeverity.MEDIUM,
        stepsToReproduce: "",
        actualResult: "",
        expectedResult: "",
      };
    } else if (currentBug) {
      if (line.match(/^\s*[-*]\s*\*\*(?:Langkah|Steps?)\*\*:\s*(.*)/i)) {
        currentBug.stepsToReproduce = line.replace(/^\s*[-*]\s*\*\*(?:Langkah|Steps?)\*\*:\s*/i, "").trim();
      } else if (line.match(/^\s*[-*]\s*\*\*(?:Aktual|Actual)\*\*:\s*(.*)/i)) {
        currentBug.actualResult = line.replace(/^\s*[-*]\s*\*\*(?:Aktual|Actual)\*\*:\s*/i, "").trim();
      } else if (line.match(/^\s*[-*]\s*\*\*(?:Ekspektasi|Expected)\*\*:\s*(.*)/i)) {
        currentBug.expectedResult = line.replace(/^\s*[-*]\s*\*\*(?:Ekspektasi|Expected)\*\*:\s*/i, "").trim();
      } else if (line.match(/^\s*[-*]\s*\*\*(?:Modul|Module)\*\*:\s*(.*)/i)) {
        currentBug.moduleArea = line.replace(/^\s*[-*]\s*\*\*(?:Modul|Module)\*\*:\s*/i, "").trim();
      } else if (line.match(/^\s*[-*]\s*\*\*(?:Severity|Keparahan)\*\*:\s*(.*)/i)) {
        currentBug.severity = normalizeSeverity(line.replace(/^\s*[-*]\s*\*\*(?:Severity|Keparahan)\*\*:\s*/i, ""));
      }
    }
  }

  if (currentBug?.title) {
    results.push(currentBug as ParsedMarkdownBug);
  }

  return results;
}
