import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test("test run: spinner dan strip animasi selama belum lolos, centang hijau setelah semua lolos", async ({ page }) => {
  const prisma = new PrismaClient();
  const project = await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } });
  const admin = await prisma.user.upsert({ where: { email: "board-qa@example.test" }, create: { email: "board-qa@example.test", name: "Board QA", status: "ACTIVE" }, update: { status: "ACTIVE" } });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    create: { projectId: project.id, userId: admin.id, role: "QA" }, update: { role: "QA" },
  });
  const stamp = Date.now();
  const cases = await Promise.all([1, 2].map((n) => prisma.testCase.create({
    data: { projectId: project.id, code: `TC-IND-${stamp}-${n}`, title: `Indikator ${n}`, steps: "1) a", expectedResult: "ok" },
  })));
  const run = await prisma.testRun.create({
    data: { projectId: project.id, name: `E2E indikator ${stamp}`, environment: "Staging", createdById: admin.id, items: { create: cases.map((c) => ({ testCaseId: c.id })) } },
    include: { items: true },
  });

  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(admin.email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);

  const url = `/projects/CRM/test-runs/${run.id}`;
  await page.goto(url);
  const badge = page.getByRole("status").filter({ hasText: "Menunggu dijalankan" });
  await expect(badge).toContainText("0/2");
  await expect(badge.locator("svg.animate-spin, svg[class*='animate-']")).toHaveCount(1);
  await expect(page.locator(".run-stripes")).toBeVisible();
  // item belum dijalankan ikut berputar di daftar kiri
  await expect(page.locator("nav[aria-label='Daftar test case'] svg[class*='animate-']")).toHaveCount(2);

  // one passed, one still waiting: still spinning, 1/2
  await prisma.testRunItem.update({ where: { id: run.items[0].id }, data: { status: "PASS" } });
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Menunggu dijalankan" })).toContainText("1/2");
  await expect(page.locator("nav[aria-label='Daftar test case'] svg[class*='animate-']")).toHaveCount(1); // hanya yang belum jalan

  // everything passed: green check, no stripes
  await prisma.testRunItem.update({ where: { id: run.items[1].id }, data: { status: "PASS" } });
  await page.reload();
  const done = page.getByRole("status").filter({ hasText: "Lolos" });
  await expect(done).toContainText("2/2");
  await expect(done.locator("svg.run-pop")).toBeVisible();
  await expect(page.locator(".run-stripes")).toHaveCount(0);

  // the run list shows the same state
  await page.goto("/projects/CRM/test-cases?tab=runs");
  await expect(page.getByRole("link", { name: new RegExp(`E2E indikator ${stamp}`) })).toContainText("Lolos");
  await prisma.testRun.delete({ where: { id: run.id } });
  await prisma.testCase.deleteMany({ where: { id: { in: cases.map((c) => c.id) } } });
  await prisma.$disconnect();
});
