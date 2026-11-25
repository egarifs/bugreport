// Loads docs/testcases/bugreport.json into the "bugreport" project (key BGR). Safe to re-run:
// project and modules are created once, test cases are upserted by code (a new version only when content changed).
// Usage: npx tsx prisma/seed-bugreport.ts you@example.com   (that user becomes project ADMIN)
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient, ProjectRole, UserStatus, type TestCasePriority } from "@prisma/client";
import { saveTestCaseCore } from "../src/lib/testcase-service";

type Dataset = {
  project: { key: string; name: string; description: string };
  modules: string[];
  testCases: {
    code: string; title: string; module: string; priority: TestCasePriority; testType: string; targetRole: string;
    precondition: string; steps: string; expectedResult: string;
  }[];
};

const prisma = new PrismaClient();
const DATA = resolve(process.cwd(), "docs/testcases/bugreport.json");
const REPORT = resolve(process.cwd(), "docs/testcases/bugreport.md");

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, "<br>");

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production.");
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Usage: npx tsx prisma/seed-bugreport.ts you@example.com");
  const data: Dataset = JSON.parse(await readFile(DATA, "utf8"));

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: email.split("@")[0], status: UserStatus.ACTIVE },
    update: {},
  });
  if (user.status !== UserStatus.ACTIVE) throw new Error(`${email} exists but is not ACTIVE; approve the user first.`);

  const project = await prisma.project.upsert({
    where: { key: data.project.key },
    create: { key: data.project.key, name: data.project.name, description: data.project.description },
    update: {},
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role: ProjectRole.ADMIN },
    update: {},
  });

  const moduleIds = new Map<string, string>();
  for (const [sortOrder, name] of data.modules.entries()) {
    const m = await prisma.module.upsert({
      where: { projectId_name: { projectId: project.id, name } },
      create: { projectId: project.id, name, sortOrder },
      update: {},
    });
    moduleIds.set(name, m.id);
  }

  let created = 0, updated = 0, same = 0;
  for (const tc of data.testCases) {
    const before = await prisma.testCase.findUnique({ where: { projectId_code: { projectId: project.id, code: tc.code } }, select: { id: true } });
    const res = await saveTestCaseCore(project.id, project.key, {
      code: tc.code, title: tc.title, moduleId: moduleIds.get(tc.module) ?? null, priority: tc.priority, status: "READY",
      testType: tc.testType, targetRole: tc.targetRole, precondition: tc.precondition, steps: tc.steps,
      expectedResult: tc.expectedResult, userId: user.id, changelog: "Seed dari docs/testcases/bugreport.json",
    });
    if (res.error) throw new Error(`${tc.code}: ${res.error}`);
    if (!before) created++; else if (res.version && res.version > 1) updated++; else same++;
  }

  const rows = data.testCases.map((t) => `| ${t.code} | ${cell(t.title)} | ${t.module} | ${t.priority} | ${t.testType} | ${t.targetRole} | ${cell(t.precondition)} | ${cell(t.steps)} | ${cell(t.expectedResult)} |`);
  await writeFile(REPORT, [
    "# Test case project bugreport",
    "",
    `Dibuat otomatis dari \`docs/testcases/bugreport.json\` oleh \`prisma/seed-bugreport.ts\` (${data.testCases.length} test case, ${data.modules.length} modul). Sumber kebenaran ada di JSON.`,
    "",
    "| Kode | Judul | Modul | Prioritas | Tipe | Role | Prasyarat | Langkah | Hasil diharapkan |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n"));

  console.log(`Project ${project.key} (${project.name}): ${created} dibuat, ${updated} diperbarui, ${same} tidak berubah. ${user.email} = ADMIN project.`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => prisma.$disconnect());
