import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma, PrismaClient, ProjectRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();
const datasetPath = resolve(process.cwd(), "docs/revamp/dataset.json");

async function main() {
  const data = JSON.parse(await readFile(datasetPath, "utf8"));
  const existingUser = await prisma.user.findUnique({ where: { email: "ega@sismedika.com" } });
  if (existingUser && existingUser.status !== UserStatus.ACTIVE) {
    throw new Error("Seed user ega@sismedika.com exists but is not ACTIVE; refusing to change account status.");
  }
  const existingProject = await prisma.project.findUnique({ where: { key: data.project.key } });
  if (existingProject) {
    throw new Error(`Project ${data.project.key} already exists; refusing to seed into an existing project.`);
  }

  await prisma.$transaction(async (tx) => {
    const user = existingUser ?? await tx.user.create({
      data: { email: "ega@sismedika.com", name: "Ega", status: UserStatus.ACTIVE },
    });
    const project = await tx.project.create({
      data: { key: data.project.key, name: data.project.name, isTest: true },
    });
    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
      create: { projectId: project.id, userId: user.id, role: ProjectRole.QA },
      update: { role: ProjectRole.QA },
    });

    for (const name of data.project.modules as string[]) {
      await tx.module.upsert({
        where: { projectId_name: { projectId: project.id, name } },
        create: { projectId: project.id, name },
        update: {},
      });
    }
    const modules = await tx.module.findMany({ where: { projectId: project.id } });
    const moduleByName = new Map(modules.map((module) => [module.name, module.id]));

    for (const item of data.testCases) {
      await tx.testCase.upsert({
        where: { projectId_code: { projectId: project.id, code: item.code } },
        create: {
          projectId: project.id,
          code: item.code,
          title: item.title,
          moduleArea: item.module,
          moduleId: moduleByName.get(item.module),
          targetRole: item.role,
          steps: item.steps.map((step: string, i: number) => `${i + 1}) ${step}`).join("\n"),
          expectedResult: item.expected,
          priority: "HIGH",
          testType: "Functional",
        },
        update: {
          title: item.title,
          moduleArea: item.module,
          moduleId: moduleByName.get(item.module),
          targetRole: item.role,
          steps: item.steps.map((step: string, i: number) => `${i + 1}) ${step}`).join("\n"),
          expectedResult: item.expected,
        },
      });
    }

    const testCase = await tx.testCase.findUniqueOrThrow({
      where: { projectId_code: { projectId: project.id, code: data.testCases[0].code } },
    });
    for (const runData of data.testRuns) {
      const resultCounts = runData.results ?? {};
      const run = await tx.testRun.upsert({
        where: { id: `test-${project.id}-${runData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` },
        create: {
          id: `test-${project.id}-${runData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          projectId: project.id,
          name: runData.name,
          environment: "Staging",
          buildVersion: runData.release,
          status: runData.status === "CLOSED" ? "COMPLETED" : "IN_PROGRESS",
          createdById: user.id,
        },
        update: {
          environment: "Staging",
          buildVersion: runData.release,
          status: runData.status === "CLOSED" ? "COMPLETED" : "IN_PROGRESS",
        },
      });
      const count = (resultCounts.PASS ?? 0) + (resultCounts.FAIL ?? 0) + (resultCounts.BLOCKED ?? 0);
      await tx.testRunItem.upsert({
        where: { testRunId_testCaseId: { testRunId: run.id, testCaseId: testCase.id } },
        create: {
          testRunId: run.id,
          testCaseId: testCase.id,
          status: resultCounts.FAIL ? "FAIL" : resultCounts.PASS ? "PASS" : "NOT_RUN",
          notes: count ? `Dataset result counts: ${JSON.stringify(resultCounts)}` : null,
        },
        update: {
          status: resultCounts.FAIL ? "FAIL" : resultCounts.PASS ? "PASS" : "NOT_RUN",
          notes: count ? `Dataset result counts: ${JSON.stringify(resultCounts)}` : null,
        },
      });
    }

    for (const item of data.bugs) {
      const number = Number(item.key.slice(item.key.lastIndexOf("-") + 1));
      const bugModuleId = item.module ? moduleByName.get(item.module) : undefined;
      const duplicateOfId = item.duplicateOf
        ? (await tx.bug.findUnique({ where: { key: item.duplicateOf }, select: { id: true } }))?.id
        : undefined;
      await tx.bug.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          number,
          projectId: project.id,
          title: item.title,
          severity: item.severity,
          priority: item.priority ?? "NORMAL",
          status: item.status,
          component: item.module ?? null,
          moduleId: bugModuleId,
          reporterId: user.id,
          assigneeId: item.assignee?.toLowerCase() === "ega" ? user.id : null,
          actualResult: item.actual ?? "",
          expectedResult: item.expected ?? "",
          appVersion: item.foundIn?.split("·")[0] ?? null,
          buildNumber: item.foundIn?.split("·")[1] ?? null,
          duplicateOfId,
          links: item.evidence ?? [],
        },
        update: {
          title: item.title,
          severity: item.severity,
          priority: item.priority ?? "NORMAL",
          status: item.status,
          component: item.module ?? null,
          moduleId: bugModuleId,
          actualResult: item.actual ?? "",
          expectedResult: item.expected ?? "",
          appVersion: item.foundIn?.split("·")[0] ?? null,
          buildNumber: item.foundIn?.split("·")[1] ?? null,
          links: item.evidence ?? [],
        },
      });
    }

    await tx.project.update({ where: { id: project.id }, data: { bugSeq: Math.max(...data.bugs.map((bug: { key: string }) => Number(bug.key.split("-").at(-1)))) } });
  });
  console.log(`Seeded test project ${data.project.key} for ega@sismedika.com`);
}

main().catch((error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) console.error(error.code, error.message);
  else console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
