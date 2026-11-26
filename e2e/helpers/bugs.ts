import type { Prisma, PrismaClient } from "@prisma/client";

// Bugs inserted straight into the database must advance Project.bugSeq, or a bug later created through the form
// takes the same number and fails on the unique key. Every spec that seeds bugs goes through here.

export type BugSeed = Pick<Prisma.BugUncheckedCreateInput, "title" | "reporterId"> &
  Partial<Omit<Prisma.BugUncheckedCreateInput, "projectId" | "number" | "key">>;

/** Move Project.bugSeq to the highest existing bug number (use before creating bugs through the UI). */
export async function syncBugSeq(prisma: PrismaClient, projectId: string) {
  const last = await prisma.bug.findFirst({ where: { projectId }, orderBy: { number: "desc" }, select: { number: true } });
  const seq = last?.number ?? 0;
  await prisma.project.update({ where: { id: projectId }, data: { bugSeq: seq } });
  return seq;
}

/** Create bugs with consecutive numbers after the current maximum and leave bugSeq pointing at the last one. */
export async function createBugs(prisma: PrismaClient, project: { id: string; key: string }, seeds: BugSeed[]) {
  let n = await syncBugSeq(prisma, project.id);
  const created = [];
  for (const seed of seeds) {
    n++;
    created.push(
      await prisma.bug.create({
        data: { severity: "LOW", status: "OPEN", actualResult: "a", expectedResult: "b", stepsToReproduce: "1", ...seed, projectId: project.id, number: n, key: `${project.key}-${n}` },
      }),
    );
  }
  await prisma.project.update({ where: { id: project.id }, data: { bugSeq: n } });
  return created;
}
