import test from "node:test";
import assert from "node:assert/strict";
import { groupKeyFor, groupNotifications } from "./notification-groups";

const now = new Date(2026, 10, 25, 15, 0);
const at = (daysAgo: number, h = 9) => new Date(2026, 10, 25 - daysAgo, h, 0);

test("groupKeyFor memisahkan hari ini, kemarin, minggu ini, lebih lama", () => {
  assert.equal(groupKeyFor(at(0, 1), now), "today");
  assert.equal(groupKeyFor(at(1, 23), now), "yesterday");
  assert.equal(groupKeyFor(at(3), now), "week");
  assert.equal(groupKeyFor(at(6), now), "week");
  assert.equal(groupKeyFor(at(7), now), "older");
});

test("groupNotifications menjaga urutan, membuang grup kosong", () => {
  const items = [{ id: "a", createdAt: at(0) }, { id: "b", createdAt: at(0, 2) }, { id: "c", createdAt: at(10) }];
  const g = groupNotifications(items, now);
  assert.deepEqual(g.map((x) => x.key), ["today", "older"]);
  assert.deepEqual(g[0].items.map((x) => x.id), ["a", "b"]);
});
