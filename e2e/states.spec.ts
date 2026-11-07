import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test("AC-STATE-01 filter tanpa hasil menawarkan hapus filter", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill("step1-qa@example.test");
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.goto("/projects/CRM?view=all&q=zzz-tidak-ada-zzz");
  await expect(page.getByText("Tidak ada bug yang cocok").first()).toBeVisible();
  await page.getByRole("link", { name: "Hapus semua filter" }).click();
  await expect(page).toHaveURL(/view=all/);
  await expect(page).not.toHaveURL(/q=/);
});

test("AC-STATE-04 peran tanpa izin melihat state tanpa akses, bukan redirect", async ({ page }) => {
  const prisma = new PrismaClient();
  const email = "viewer-e2e@example.test";
  const [user, project] = await Promise.all([
    prisma.user.upsert({ where: { email }, create: { email, name: "Viewer E2E", status: "ACTIVE" }, update: {} }),
    prisma.project.findUniqueOrThrow({ where: { key: "CRM" } }),
  ]);
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role: "VIEWER" },
    update: { role: "VIEWER" },
  });
  await prisma.$disconnect();

  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  for (const path of ["test-cases", "test-runs/new", "chat"]) {
    await page.goto(`/projects/CRM/${path}`);
    await expect(page).toHaveURL(new RegExp(`/projects/CRM/${path}`));
    await expect(page.getByText("Anda tidak punya akses")).toBeVisible();
  }
});
