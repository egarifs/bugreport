// Create a test run holding every test case of a project (dev helper). Usage: npx tsx scripts/create-test-run.ts BGR "Run name" [environment]
import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run in production");
  const [key, name, environment = "local"] = process.argv.slice(2);
  if (!key || !name) throw new Error('Usage: create-test-run.ts <PROJECT_KEY> "<name>" [environment]');
  const prisma = new PrismaClient();
  try {
    const project = await prisma.project.findUniqueOrThrow({ where: { key } });
    const creator = await prisma.projectMember.findFirstOrThrow({ where: { projectId: project.id, role: "ADMIN" } });
    const cases = await prisma.testCase.findMany({ where: { projectId: project.id }, select: { id: true } });
    const run = await prisma.testRun.create({
      data: { projectId: project.id, name, environment, createdById: creator.userId, items: { create: cases.map((c) => ({ testCaseId: c.id })) } },
    });
    console.log(`Run ${run.id}: ${cases.length} items -> /projects/${key}/test-runs/${run.id}`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
