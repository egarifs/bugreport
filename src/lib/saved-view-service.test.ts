import { createTestProject } from "./test-project";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { createSavedView, deleteSavedView, listSavedViews } from "./saved-view-service";
import { sanitizeViewQuery } from "./bug-list-query";

test("sanitizeViewQuery keeps known filters and drops everything else", () => {
  assert.equal(sanitizeViewQuery("severity=HIGH,NOPE&evil=1&page=4&cols=100&layout=board"), "view=all&layout=board&severity=HIGH");
});

test("saved views: private by default, sharing needs review rights, delete limited to owner/manager", async () => {
  const t = Date.now();
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}_sv${t}@example.com`, name: n, status: "ACTIVE" } });
  const [qa, vendor, pm] = await Promise.all([mk("qa"), mk("vendor"), mk("pm")]);
  const project = await createTestProject({
    data: {
      key: `SV${String(t).slice(-6)}`, name: "Views",
      members: { create: [{ userId: qa.id, role: "QA" }, { userId: vendor.id, role: "VENDOR" }, { userId: pm.id, role: "ADMIN" }] },
    },
  });
  const Q = { ...qa, role: "QA" as const };
  const V = { ...vendor, role: "VENDOR" as const };
  const P = { ...pm, role: "ADMIN" as const };

  assert.ok((await createSavedView(Q, project.id, { name: "Kritis", query: "severity=BLOCKER", share: true })).ok);
  assert.ok((await createSavedView(V, project.id, { name: "Punya saya", query: "assignee=x", share: false })).ok);
  assert.match((await createSavedView(V, project.id, { name: "Bagi", query: "", share: true })).error ?? "", /reviewer/);
  assert.match((await createSavedView(Q, project.id, { name: "Kritis", query: "", share: false })).error ?? "", /sudah dipakai/);
  assert.match((await createSavedView(Q, project.id, { name: "  ", query: "", share: false })).error ?? "", /nama/i);

  // vendor sees own + shared, QA does not see vendor's private view
  assert.deepEqual((await listSavedViews(project.id, vendor.id)).map((v) => v.name).sort(), ["Kritis", "Punya saya"]);
  assert.deepEqual((await listSavedViews(project.id, qa.id)).map((v) => v.name), ["Kritis"]);

  const shared = (await listSavedViews(project.id, vendor.id)).find((v) => v.name === "Kritis")!;
  assert.match((await deleteSavedView(V, project.id, shared.id)).error ?? "", /pembuat/);
  assert.ok((await deleteSavedView(Q, project.id, shared.id)).ok);
  const mine = (await listSavedViews(project.id, vendor.id)).find((v) => v.name === "Punya saya")!;
  assert.ok((await deleteSavedView(P, project.id, mine.id)).ok); // project ADMIN manages
});
