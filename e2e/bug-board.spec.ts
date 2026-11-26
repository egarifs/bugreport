import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createBugs } from "./helpers/bugs";

async function qaLogin(prisma: PrismaClient, page: import("@playwright/test").Page) {
  const email = "board-qa@example.test";
  const project = await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } });
  const user = await prisma.user.upsert({ where: { email }, create: { email, name: "Board QA", status: "ACTIVE" }, update: { status: "ACTIVE" } });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role: "QA" },
    update: { role: "QA" },
  });
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  return { project, user };
}

test("board: pindah kartu lewat menu, status tersimpan; transisi terlarang tidak ada di menu", async ({ page }) => {
  const prisma = new PrismaClient();
  const email = "board-qa@example.test";
  const project = await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } });
  const user = await prisma.user.upsert({ where: { email }, create: { email, name: "Board QA", status: "ACTIVE" }, update: { status: "ACTIVE" } });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role: "QA" },
    update: { role: "QA" },
  });
  const title = `E2E board ${Date.now()}`;
  const [bug] = await createBugs(prisma, project, [{ title, severity: "HIGH", reporterId: user.id }]);
  const n = bug.number;

  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?layout=board&q=${encodeURIComponent(title)}`);

  // filter menu: severity High keeps the card, Low hides it
  await page.getByRole("button", { name: /^Filter( \d+)?$/ }).click();
  await page.getByRole("button", { name: /^Severity/ }).click();
  await page.getByRole("checkbox", { name: "Low" }).check();
  await expect(page.getByText(title)).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Low" }).uncheck();
  await page.getByRole("checkbox", { name: "High" }).check();
  await page.keyboard.press("Escape");

  const open = page.getByRole("listitem", { name: /^Open/ });
  await expect(open.getByText(title)).toBeVisible();
  const menu = page.getByLabel(`Pindahkan CRM-${n} ke`);
  await expect(menu.locator("option", { hasText: "Closed" })).toHaveCount(0); // needs detail page
  await menu.selectOption({ label: "In progress" });

  await expect(page.getByRole("listitem", { name: /^In progress/ }).getByText(title)).toBeVisible();
  await expect.poll(async () => (await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe("IN_PROGRESS");
  await prisma.$disconnect();
});

test("board: seret kartu ke kolom valid pindah, ke kolom yang tidak diizinkan ditolak; tag ditambah di detail dan bisa difilter", async ({ page }) => {
  const prisma = new PrismaClient();
  const { project, user } = await qaLogin(prisma, page);
  const title = `E2E drag ${Date.now()}`;
  const [bug] = await createBugs(prisma, project, [{ title, severity: "HIGH", reporterId: user.id }]);
  const n = bug.number;
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`/projects/CRM?layout=board&q=${encodeURIComponent(title)}`);
  const card = page.getByRole("listitem").filter({ hasText: title }).last();

  // a drop before hydration does nothing and the toast lasts 3.5s, so retry the (harmless, refused) drag until it shows
  await expect(async () => {
    await card.dragTo(page.getByRole("listitem", { name: /^Draft/ }));
    await expect(page.getByRole("status").filter({ hasText: "tidak bisa dipindah" })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  expect((await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe("OPEN");

  await card.dragTo(page.getByRole("listitem", { name: /^In progress/ }));
  await expect.poll(async () => (await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe("IN_PROGRESS");

  await page.goto(`/projects/CRM/bugs/${n}`);
  await page.getByLabel("Tambah tag").fill("E2E Tag");
  await page.getByLabel("Tambah tag").press("Enter");
  await expect(page.getByText("#e2e-tag")).toBeVisible();

  await page.goto(`/projects/CRM?view=all&layout=list&q=${encodeURIComponent(title)}`);
  await page.getByRole("button", { name: /^Filter( \d+)?$/ }).click();
  await page.getByRole("button", { name: /^Tag/ }).click();
  await page.getByRole("checkbox", { name: "#e2e-tag" }).check();
  await expect(page).toHaveURL(/tag=/);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await prisma.$disconnect();
});

test("filter tersimpan: simpan, terapkan dari menu, hapus", async ({ page }) => {
  const prisma = new PrismaClient();
  const { project, user } = await qaLogin(prisma, page);
  await prisma.savedBugView.deleteMany({ where: { projectId: project.id, ownerId: user.id } });
  const name = `E2E kritis ${Date.now()}`;
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/projects/CRM?view=all&severity=BLOCKER");

  await page.getByRole("button", { name: /^Filter( \d+)?$/ }).click();
  await page.getByRole("button", { name: /^Filter tersimpan/ }).click();
  await page.getByLabel("Nama filter").fill(name);
  await page.getByRole("button", { name: "Simpan filter" }).click();
  await expect(page.getByText("Filter disimpan.")).toBeVisible();
  expect((await prisma.savedBugView.findFirstOrThrow({ where: { projectId: project.id, ownerId: user.id, name } })).query).toContain("severity=BLOCKER");

  // apply from a clean URL
  await page.goto("/projects/CRM?view=all");
  await page.getByRole("button", { name: /^Filter( \d+)?$/ }).click();
  await page.getByRole("button", { name: /^Filter tersimpan/ }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page).toHaveURL(/severity=BLOCKER/);
  await expect(page.getByRole("button", { name: /Hapus filter Severity/ })).toBeVisible();

  await page.getByRole("button", { name: /^Filter( \d+)?$/ }).click();
  await page.getByRole("button", { name: /^Filter tersimpan/ }).click();
  await page.getByRole("button", { name: `Hapus filter ${name}` }).click();
  await expect.poll(() => prisma.savedBugView.count({ where: { projectId: project.id, ownerId: user.id, name } })).toBe(0);
  await prisma.$disconnect();
});

test("aksi massal: ubah status, assign, dan tag beberapa bug sekaligus", async ({ page }) => {
  const prisma = new PrismaClient();
  const { project, user } = await qaLogin(prisma, page);
  const stamp = `E2E massal ${Date.now()}`;
  const made = await createBugs(prisma, project, [0, 1].map((i) => ({ title: `${stamp} ${i}`, reporterId: user.id })));
  const base = made[0].number;
  const ids = made.map((b) => b.id);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(stamp)}`);
  await expect(page.getByRole("form", { name: "Aksi massal" })).toBeHidden();

  await page.getByRole("checkbox", { name: "Pilih semua bug di halaman ini" }).check();
  const bar = page.getByRole("form", { name: "Aksi massal" });
  await expect(bar.getByText("dipilih")).toContainText("2");

  await bar.getByLabel("Status tujuan").selectOption({ label: "In progress" });
  await bar.getByRole("button", { name: "Terapkan" }).first().click();
  await expect(bar.getByRole("status")).toContainText("2 bug diubah");
  await expect.poll(() => prisma.bug.count({ where: { id: { in: ids }, status: "IN_PROGRESS" } })).toBe(2);

  // selection cleared after success; pick one again and tag it
  await page.getByRole("checkbox", { name: `Pilih CRM-${base}` }).check();
  await bar.getByLabel("Tag", { exact: true }).fill("massal-e2e");
  await bar.getByRole("button", { name: "Tambah" }).click();
  await expect(bar.getByRole("status")).toContainText("1 bug diubah");
  expect(await prisma.bug.count({ where: { id: { in: ids }, tags: { some: { name: "massal-e2e" } } } })).toBe(1);

  await expect(bar.getByText("dipilih")).toContainText("0"); // selection cleared after success
  await page.getByRole("checkbox", { name: `Pilih CRM-${base + 1}` }).check();
  await bar.getByLabel("Assignee").selectOption({ label: "Board QA" });
  await bar.getByRole("button", { name: "Terapkan" }).nth(1).click();
  await expect.poll(async () => (await prisma.bug.findUniqueOrThrow({ where: { id: ids[1] } })).assigneeId).toBe(user.id);
  await prisma.$disconnect();
});

test("pintasan J/K memilih bug berikutnya di list dan panel pratinjau muncul", async ({ page }) => {
  const prisma = new PrismaClient();
  const { project, user } = await qaLogin(prisma, page);
  const stamp = `E2E jk ${Date.now()}`;
  await createBugs(prisma, project, [0, 1].map((i) => ({ title: `${stamp} ${i}`, status: "DRAFT" as const, reporterId: user.id })));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(stamp)}`);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  // keys pressed before hydration are lost: repeat until the selection reaches the URL
  await expect(async () => {
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/sel=CRM-\d+/, { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("complementary", { name: /Pratinjau dan triase CRM-/ })).toBeVisible();
  await prisma.$disconnect();
});
