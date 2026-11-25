import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

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
  const last = await prisma.bug.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
  const n = (last?.number ?? 0) + 1;
  const title = `E2E board ${Date.now()}`;
  const bug = await prisma.bug.create({
    data: { projectId: project.id, number: n, key: `CRM-${n}`, title, severity: "HIGH", status: "OPEN", reporterId: user.id, actualResult: "a", expectedResult: "b", stepsToReproduce: "1" },
  });

  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/projects/CRM?layout=board&q=${encodeURIComponent(title)}`);

  // filter menu: severity High keeps the card, Low hides it
  await page.getByRole("button", { name: "Filter" }).click();
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
  const last = await prisma.bug.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
  const n = (last?.number ?? 0) + 1;
  const title = `E2E drag ${Date.now()}`;
  const bug = await prisma.bug.create({
    data: { projectId: project.id, number: n, key: `CRM-${n}`, title, severity: "HIGH", status: "OPEN", reporterId: user.id, actualResult: "a", expectedResult: "b", stepsToReproduce: "1" },
  });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`/projects/CRM?layout=board&q=${encodeURIComponent(title)}`);
  const card = page.getByRole("listitem").filter({ hasText: title }).last();

  await card.dragTo(page.getByRole("listitem", { name: /^Draft/ }));
  await expect(page.getByRole("status").filter({ hasText: "tidak bisa dipindah" })).toBeVisible();
  expect((await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe("OPEN");

  await card.dragTo(page.getByRole("listitem", { name: /^In progress/ }));
  await expect.poll(async () => (await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } })).status).toBe("IN_PROGRESS");

  await page.goto(`/projects/CRM/bugs/${n}`);
  await page.getByLabel("Tambah tag").fill("E2E Tag");
  await page.getByLabel("Tambah tag").press("Enter");
  await expect(page.getByText("#e2e-tag")).toBeVisible();

  await page.goto(`/projects/CRM?view=all&q=${encodeURIComponent(title)}`);
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("button", { name: /^Tag/ }).click();
  await page.getByRole("checkbox", { name: "#e2e-tag" }).check();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await prisma.$disconnect();
});
