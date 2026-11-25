import { createTestProject } from "./test-project";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { loadBoard } from "./bug-board-service";
import { buildBugWhere, parseBugListFilters } from "./bug-list-query";

test("loadBoard groups by column, counts beyond the limit, applies filters and tags", async () => {
  const t = Date.now();
  const user = await prisma.user.create({ data: { email: `bd_${t}@example.com`, name: "bd", status: "ACTIVE" } });
  const project = await createTestProject({
    data: { key: `BD${String(t).slice(-6)}`, name: "Board", members: { create: [{ userId: user.id, role: "QA" }] } },
  });
  const tag = await prisma.bugTag.create({ data: { projectId: project.id, name: "ui" } });
  const mk = (n: number, status: "OPEN" | "WONT_FIX" | "IN_PROGRESS", severity: "HIGH" | "LOW", tags = false) =>
    prisma.bug.create({
      data: {
        projectId: project.id, number: n, key: `${project.key}-${n}`, title: `b${n}`, severity, status, reporterId: user.id,
        ...(tags ? { tags: { connect: { id: tag.id } } } : {}),
      },
    });
  await Promise.all([mk(1, "OPEN", "HIGH", true), mk(2, "OPEN", "LOW"), mk(3, "OPEN", "HIGH"), mk(4, "WONT_FIX", "HIGH"), mk(5, "IN_PROGRESS", "LOW", true)]);

  const ctx = { projectId: project.id, userId: user.id };
  const all = await loadBoard(buildBugWhere(parseBugListFilters({ view: "all" }, "all"), ctx), 2);
  const col = (id: string) => all.find((c) => c.id === id)!;
  assert.equal(col("open").count, 3);
  assert.equal(col("open").cards.length, 2); // limited, but header still shows the real total
  assert.equal(col("open").cards[0].severity, "HIGH"); // most severe first
  assert.equal(col("other").count, 1); // WONT_FIX lands in "Lainnya"
  assert.equal(col("closed").count, 0);

  const high = await loadBoard(buildBugWhere(parseBugListFilters({ view: "all", severity: "HIGH" }, "all"), ctx), 25);
  assert.equal(high.reduce((n, c) => n + c.count, 0), 3);

  const tagged = await loadBoard(buildBugWhere(parseBugListFilters({ view: "all", tag: tag.id }, "all"), ctx), 25);
  assert.deepEqual(tagged.flatMap((c) => c.cards.map((x) => x.key)).sort(), [`${project.key}-1`, `${project.key}-5`]);
  assert.deepEqual(tagged.find((c) => c.id === "in_progress")!.cards[0].tags, ["ui"]);

  // another project's bugs never appear
  const other = await createTestProject({ data: { key: `BE${String(t).slice(-6)}`, name: "Other" } });
  const none = await loadBoard(buildBugWhere(parseBugListFilters({ view: "all" }, "all"), { projectId: other.id, userId: user.id }), 25);
  assert.equal(none.reduce((n, c) => n + c.count, 0), 0);
});
