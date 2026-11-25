import test from "node:test";
import assert from "node:assert/strict";
import { groupSprints, sprintGroupOf } from "./sprint-groups";

const now = new Date(2026, 10, 25);
const sp = (name: string, status: string, day: number) => ({ name, status, startsAt: new Date(2026, 10, day) });

test("sprintGroupOf: aktif yang belum mulai = berikutnya", () => {
  assert.equal(sprintGroupOf(sp("a", "ACTIVE", 20), now), "running");
  assert.equal(sprintGroupOf(sp("b", "ACTIVE", 30), now), "upcoming");
  assert.equal(sprintGroupOf(sp("c", "COMPLETED", 1), now), "done");
});

test("groupSprints mengurutkan dan membuang grup kosong", () => {
  const g = groupSprints([sp("old", "COMPLETED", 1), sp("cur", "ACTIVE", 20), sp("n2", "ACTIVE", 40 - 5), sp("n1", "ACTIVE", 28)], now);
  assert.deepEqual(g.map((x) => x.key), ["running", "upcoming", "done"]);
  assert.deepEqual(g[1].items.map((x) => x.name), ["n1", "n2"]);
  assert.deepEqual(groupSprints([sp("old", "COMPLETED", 1)], now).map((x) => x.key), ["done"]);
});
