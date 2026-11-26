import { test, expect, type Page } from "@playwright/test";
import { PrismaClient, type ProjectRole } from "@prisma/client";
import { createBugs } from "./helpers/bugs";

// Regression for the "bugreport" test cases (docs/testcases/bugreport.json). Test names start with the case code(s).
const prisma = new PrismaClient();
test.afterAll(async () => { await prisma.$disconnect(); });

async function loginAs(page: Page, email: string, role: ProjectRole) {
  const project = await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } });
  const user = await prisma.user.upsert({ where: { email }, create: { email, name: email.split("@")[0], status: "ACTIVE" }, update: { status: "ACTIVE" } });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role },
    update: { role },
  });
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  return { project, user };
}

const filterBtn = (p: Page) => p.getByRole("button", { name: /^Filter( \d+)?$/ });
const stamp = () => `E2E-BGR ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

test("TC-LIST-001 TC-FLT-001: tab sesuai role dan menu Filter dua panel", async ({ page }) => {
  await loginAs(page, "bgr-qa@example.test", "QA");
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/projects/CRM");
  const nav = page.getByRole("navigation", { name: "Tampilan bug" });
  for (const t of ["Perlu review", "Tugas saya", "Semua bug"]) await expect(nav.getByRole("link", { name: new RegExp(`^${t}`) })).toBeVisible();
  const draftCount = await prisma.bug.count({ where: { project: { key: "CRM" }, status: "DRAFT" } });
  await expect(nav.getByRole("link", { name: /^Perlu review/ })).toContainText(String(draftCount));

  await filterBtn(page).click();
  const dialog = page.getByRole("dialog", { name: "Filter bug" });
  for (const c of ["Filter tersimpan", "Assignee", "Dilaporkan oleh", "Severity", "Priority", "Status", "Modul", "Tag", "Sprint"]) {
    await expect(dialog.getByRole("button", { name: new RegExp(`^${c}`) })).toBeVisible();
  }
});

test("TC-FLT-002 TC-FLT-003 TC-FLT-006 TC-FLT-009: severity, OR, chip, reset, cari tetap memakai filter", async ({ page }) => {
  const { project, user } = await loginAs(page, "bgr-qa@example.test", "QA");
  const s = stamp();
  await createBugs(prisma, project, [
    { title: `${s} blocker`, severity: "BLOCKER", reporterId: user.id },
    { title: `${s} high`, severity: "HIGH", reporterId: user.id },
    { title: `${s} low`, severity: "LOW", reporterId: user.id },
  ]);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}`);

  await filterBtn(page).click();
  await page.getByRole("button", { name: /^Severity/ }).click();
  await page.getByRole("checkbox", { name: "High" }).check();
  await expect(page).toHaveURL(/severity=HIGH/);
  await expect(page.getByRole("link", { name: `${s} high` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${s} low` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Hapus filter Severity: High/ })).toBeVisible();
  await expect(filterBtn(page)).toContainText("1");

  await page.getByRole("checkbox", { name: "Blocker" }).check();
  await expect(page.getByRole("link", { name: `${s} blocker` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${s} high` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${s} low` })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // search keeps the active severity filter
  await page.getByRole("searchbox", { name: "Cari bug" }).fill(`${s} high`);
  await page.getByRole("searchbox", { name: "Cari bug" }).press("Enter");
  await expect(page).toHaveURL(/severity=/);
  await expect(page.getByRole("link", { name: `${s} high` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${s} blocker` })).toHaveCount(0);

  // chip removes its category, Reset clears everything
  // the search reloaded the page: retry the click until hydration has attached the handler
  await expect(async () => {
    await page.getByRole("button", { name: /^Hapus filter Severity/ }).click({ timeout: 1000 });
    await expect(page).not.toHaveURL(/severity=/, { timeout: 1000 });
  }).toPass();
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}&severity=HIGH&status=OPEN`);
  await expect(async () => {
    await page.getByRole("button", { name: "Reset" }).click({ timeout: 1000 });
    await expect(page).not.toHaveURL(/severity=|status=/, { timeout: 1000 });
  }).toPass();
  await expect(filterBtn(page)).not.toContainText(/\d/);
});

test("TC-FLT-005 TC-FLT-007: Belum di-assign, Ditugaskan ke saya, kotak cari pilihan", async ({ page }) => {
  const { project, user } = await loginAs(page, "bgr-qa@example.test", "QA");
  const s = stamp();
  await createBugs(prisma, project, [
    { title: `${s} milik saya`, reporterId: user.id, assigneeId: user.id },
    { title: `${s} tanpa assignee`, reporterId: user.id },
  ]);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}`);
  await filterBtn(page).click();
  await page.getByRole("button", { name: "Belum di-assign" }).click();
  await expect(page.getByRole("link", { name: `${s} tanpa assignee` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${s} milik saya` })).toHaveCount(0);
  await page.getByRole("button", { name: "Ditugaskan ke saya" }).click();
  await expect(page.getByRole("link", { name: `${s} milik saya` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${s} tanpa assignee` })).toHaveCount(0);

  await page.getByRole("button", { name: /^Assignee/ }).click();
  await page.getByRole("searchbox", { name: "Cari Assignee" }).fill("bgr-qa");
  const group = page.getByRole("group", { name: "Assignee" });
  await expect(group.getByRole("checkbox")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Cari Assignee" }).fill("zzzzzz-tidak-ada");
  await expect(group.getByRole("checkbox")).toHaveCount(0);
});

test("TC-FLT-010: menu Filter muat di ponsel tanpa scroll horizontal", async ({ page }) => {
  await loginAs(page, "bgr-qa@example.test", "QA");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/projects/CRM?view=all");
  await filterBtn(page).click();
  const dialog = page.getByRole("dialog", { name: "Filter bug" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("TC-LIST-003 TC-LIST-004: paginasi 25 per halaman dan metadata baris", async ({ page }) => {
  const { project, user } = await loginAs(page, "bgr-qa@example.test", "QA");
  const s = stamp();
  const bugs = await createBugs(prisma, project, Array.from({ length: 27 }, (_, i) => ({ title: `${s} ${String(i).padStart(2, "0")}`, reporterId: user.id })));
  const mod = await prisma.module.findFirst({ where: { projectId: project.id } });
  const tag = await prisma.bugTag.upsert({ where: { projectId_name: { projectId: project.id, name: "e2e-meta" } }, create: { projectId: project.id, name: "e2e-meta" }, update: {} });
  const newest = bugs[bugs.length - 1]; // list is newest first, so it is on page 1
  await prisma.bugComment.create({ data: { bugId: newest.id, authorId: user.id, body: "komentar e2e" } });
  await prisma.bug.update({ where: { id: newest.id }, data: { moduleId: mod?.id, tags: { connect: { id: tag.id } } } });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}`);
  const pager = page.getByRole("navigation", { name: "Halaman" });
  await expect(pager).toContainText("1–25 dari 27");
  await expect(pager.getByText("Sebelumnya")).toHaveAttribute("aria-disabled");
  await pager.getByRole("link", { name: "Berikutnya" }).click();
  await expect(pager).toContainText("26–27 dari 27");
  await expect(pager.getByText("Berikutnya")).toHaveAttribute("aria-disabled");
  await pager.getByRole("link", { name: "Sebelumnya" }).click();
  await expect(pager).toContainText("1–25 dari 27");

  const row = page.getByRole("row").filter({ hasText: newest.title });
  await expect(row.getByText("#e2e-meta")).toBeVisible();
  if (mod) await expect(row.getByText(mod.name).first()).toBeVisible();
  await expect(row.getByText(/💬 1 · 📎 0/)).toBeVisible();
});

test("TC-BLK-002: pilih semua memilih seluruh baris halaman", async ({ page }) => {
  const { project, user } = await loginAs(page, "bgr-qa@example.test", "QA");
  const s = stamp();
  await createBugs(prisma, project, Array.from({ length: 3 }, (_, i) => ({ title: `${s} ${i}`, reporterId: user.id })));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}`);
  await page.getByRole("checkbox", { name: "Pilih semua bug di halaman ini" }).check();
  await expect(page.getByRole("form", { name: "Aksi massal" }).getByText("dipilih")).toContainText("3");
  for (const cb of await page.getByRole("checkbox", { name: /^Pilih CRM-/ }).all()) await expect(cb).toBeChecked();
});

test("TC-BRD-001 TC-BRD-002: toggle Board diingat dan kolom sesuai status", async ({ page }) => {
  await loginAs(page, "bgr-qa@example.test", "QA");
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/projects/CRM?view=all");
  await page.evaluate(() => localStorage.removeItem("bug-layout"));
  await page.getByRole("group", { name: "Tampilan" }).getByRole("link", { name: "Board" }).click();
  await expect(page).toHaveURL(/layout=board/);
  const board = page.getByRole("list", { name: "Board bug" });
  for (const c of ["Draft", "Open", "In progress", "Design Review", "Ready for QA", "Reopened", "Closed", "Lainnya"]) {
    await expect(board.getByRole("listitem", { name: new RegExp(`^${c}, \\d+ bug`) })).toBeVisible();
  }
  const openCount = await prisma.bug.count({ where: { project: { key: "CRM" }, status: "OPEN" } });
  await expect(board.getByRole("listitem", { name: new RegExp(`^Open, ${openCount} bug`) })).toBeVisible();
  await page.goto("/projects/CRM?view=all"); // no ?layout: remembered choice applies
  await expect(page).toHaveURL(/layout=board/);
});

test("TC-LIST-002 TC-BRD-007 TC-BLK-007 TC-TAG-004 TC-TRI-004: role tanpa izin", async ({ page, browser }) => {
  const { project, user } = await loginAs(page, "bgr-viewer@example.test", "VIEWER");
  const s = stamp();
  const [draft, open] = await createBugs(prisma, project, [
    { title: `${s} draft`, status: "DRAFT", reporterId: user.id },
    { title: `${s} open`, status: "OPEN", reporterId: user.id },
  ]);
  await prisma.bug.update({ where: { id: open.id }, data: { tags: { connectOrCreate: { where: { projectId_name: { projectId: project.id, name: "e2e-ro" } }, create: { projectId: project.id, name: "e2e-ro" } } } } });
  await page.setViewportSize({ width: 1600, height: 900 });

  // viewer: no checkboxes / bulk bar, no move menu, no tag controls
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}`);
  await expect(page.getByRole("link", { name: `${s} open` })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Aksi massal" })).toHaveCount(0);
  await page.goto(`/projects/CRM?layout=board&q=${encodeURIComponent(s)}`);
  await expect(page.getByText(`${s} open`)).toBeVisible();
  await expect(page.getByLabel(`Pindahkan ${open.key} ke`)).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: `${s} open` }).last()).not.toHaveAttribute("draggable", "true");
  await page.goto(`/projects/CRM/bugs/${open.number}`);
  await expect(page.getByText("#e2e-ro")).toBeVisible();
  await expect(page.getByLabel("Tambah tag")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Hapus tag/ })).toHaveCount(0);

  // developer: triage panel is reviewer-only
  const dev = await browser.newContext();
  const p2 = await dev.newPage();
  await loginAs(p2, "bgr-dev@example.test", "DEVELOPER");
  await p2.setViewportSize({ width: 1600, height: 900 });
  await p2.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}&sel=${draft.key}`);
  await expect(p2.getByText("Triase hanya untuk reviewer.")).toBeVisible();
  await expect(p2.getByRole("button", { name: "Terima" })).toHaveCount(0);
  await dev.close();

  // client goes to the portal
  const cli = await browser.newContext();
  const p3 = await cli.newPage();
  await loginAs(p3, "bgr-client@example.test", "CLIENT");
  await p3.goto("/projects/CRM");
  await expect(p3).toHaveURL(/\/projects\/CRM\/portal/);
  await expect(p3.getByText(`${s} open`)).toHaveCount(0);
  await cli.close();
});

test("TC-TRI-002 TC-TRI-003: terima tanpa modul ditolak, tolak menjadi Invalid", async ({ page }) => {
  const { project, user } = await loginAs(page, "bgr-qa@example.test", "QA");
  const s = stamp();
  const [a, b] = await createBugs(prisma, project, [
    { title: `${s} a`, status: "DRAFT", reporterId: user.id },
    { title: `${s} b`, status: "DRAFT", reporterId: user.id },
  ]);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}&sel=${a.key}`);
  const panel = page.getByRole("complementary", { name: new RegExp(`Pratinjau dan triase ${a.key}`) });
  await panel.getByLabel("Modul").selectOption("");
  await panel.getByRole("button", { name: "Terima" }).click();
  await expect(page.getByText(/Pilih modul sebelum menerima/)).toBeVisible();
  expect((await prisma.bug.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("DRAFT");

  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(s)}&sel=${b.key}`);
  await page.getByRole("complementary", { name: new RegExp(`Pratinjau dan triase ${b.key}`) }).getByRole("button", { name: "Tolak" }).click();
  await expect.poll(async () => (await prisma.bug.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("INVALID");
});

test("TC-BRD-008: Muat lagi menambah kartu di kolom panjang", async ({ page }) => {
  const { project, user } = await loginAs(page, "bgr-qa@example.test", "QA");
  const s = stamp();
  await createBugs(prisma, project, Array.from({ length: 27 }, (_, i) => ({ title: `${s} ${String(i).padStart(2, "0")}`, status: "OPEN" as const, reporterId: user.id })));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`/projects/CRM?layout=board&q=${encodeURIComponent(s)}`);
  const open = page.getByRole("listitem", { name: /^Open, 27 bug/ });
  await expect(open.getByRole("link", { name: /Muat lagi \(2\)/ })).toBeVisible();
  await expect(open.getByText(new RegExp(`^${s} `))).toHaveCount(25);
  await open.getByRole("link", { name: /Muat lagi/ }).click();
  await expect(open.getByText(new RegExp(`^${s} `))).toHaveCount(27);
  await expect(open.getByRole("link", { name: /Muat lagi/ })).toHaveCount(0);
});

test("TC-BRD-009: pemindahan dari board basi ditolak, status orang lain tidak tertimpa", async ({ page, browser }) => {
  const { project, user } = await loginAs(page, "bgr-qa@example.test", "QA");
  const s = stamp();
  const [bug] = await createBugs(prisma, project, [{ title: `${s} balapan`, status: "OPEN", reporterId: user.id }]);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`/projects/CRM?layout=board&q=${encodeURIComponent(s)}`);
  const menuB = page.getByLabel(`Pindahkan ${bug.key} ke`);
  await expect(menuB).toBeVisible(); // browser B has loaded the board while the bug is Open

  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await loginAs(a, "bgr-qa@example.test", "QA");
  await a.setViewportSize({ width: 1600, height: 900 });
  await a.goto(`/projects/CRM?layout=board&q=${encodeURIComponent(s)}`);
  await a.getByLabel(`Pindahkan ${bug.key} ke`).selectOption({ label: "In progress" });
  await expect.poll(async () => (await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe("IN_PROGRESS");
  await ctx.close();

  await menuB.selectOption({ label: "Design Review" }); // B still believes the bug is Open
  await expect(page.getByRole("status").filter({ hasText: /sudah berubah/ })).toBeVisible();
  expect((await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe("IN_PROGRESS");
});

test("TC-BRD-010: sembunyikan kolom board, pilihan diingat, minimal satu kolom tersisa", async ({ page }) => {
  await loginAs(page, "bgr-qa@example.test", "QA");
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/projects/CRM?layout=board&view=all");
  await page.evaluate(() => localStorage.removeItem("bug-board-hide"));
  await page.reload();
  const board = page.getByRole("list", { name: "Board bug" });
  await expect(board.getByRole("listitem", { name: /^Closed, / })).toBeVisible();

  const open = async () => {
    const dialog = page.getByRole("dialog", { name: "Kolom board" });
    // a click before hydration is lost: click again until the menu shows (never while it is already open)
    await expect(async () => {
      if (!(await dialog.isVisible())) await page.getByRole("button", { name: /^Kolom/ }).click();
      await expect(dialog).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    return dialog;
  };
  let menu = await open();
  await menu.getByRole("checkbox", { name: "Closed" }).uncheck();
  await menu.getByRole("checkbox", { name: "Lainnya" }).uncheck();
  await expect(page).toHaveURL(/hide=closed%2Cother/);
  await expect(board.getByRole("listitem", { name: /^Closed, / })).toHaveCount(0);
  await expect(board.getByRole("listitem", { name: /^Lainnya, / })).toHaveCount(0);
  await expect(board.getByRole("listitem", { name: /^Open, / })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Kolom/ })).toContainText("6/8");

  // remembered: a board URL without ?hide comes back with the same columns hidden
  await page.goto("/projects/CRM?layout=board&view=all");
  await expect(page).toHaveURL(/hide=closed%2Cother/);
  await expect(board.getByRole("listitem", { name: /^Closed, / })).toHaveCount(0);

  // show all again
  menu = await open();
  await menu.getByRole("button", { name: "Tampilkan semua" }).click();
  await expect(board.getByRole("listitem", { name: /^Closed, / })).toBeVisible();

  // the last visible column cannot be hidden
  menu = await open();
  for (const c of ["Draft", "Open", "In progress", "Design Review", "Ready for QA", "Reopened", "Closed"]) await menu.getByRole("checkbox", { name: c, exact: true }).uncheck();
  await expect(menu.getByRole("checkbox", { name: "Lainnya" })).toBeDisabled();
  await expect(board.getByRole("listitem", { name: /, \d+ bug$/ })).toHaveCount(1);
});
