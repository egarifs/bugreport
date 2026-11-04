import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

describe("test seed inputs and safety", () => {
  it("AC-SEED-01 reads project data from the approved dataset", async () => {
    const data = JSON.parse(await readFile(resolve(root, "docs/revamp/dataset.json"), "utf8"));
    expect(data.project).toMatchObject({ key: "CRM", name: "CRM Sismedika" });
    expect(data.bugs).toHaveLength(5);
    expect(data.testCases).toHaveLength(1);
  });

  it("AC-SEED-02 refuses to modify an existing non-test CRM project", async () => {
    const seed = await readFile(resolve(root, "prisma/seed-test.ts"), "utf8");
    expect(seed).toContain('if (existingProject && !existingProject.isTest)');
    expect(seed).toContain("refusing to modify it");
  });

  it("AC-SEED-03 uses approved Ega account and marks project as test", async () => {
    const seed = await readFile(resolve(root, "prisma/seed-test.ts"), "utf8");
    expect(seed).toContain('email: "ega@sismedika.com"');
    expect(seed).toContain("isTest: true");
    expect(seed).toContain("refusing to change account status");
  });
});
