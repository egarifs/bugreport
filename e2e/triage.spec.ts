import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test("triase: pilih draft, ubah severity, terima lewat pintasan A", async ({ page }) => {
  const prisma = new PrismaClient();
  const email = "step1-qa@example.test";
  const [user, project] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email } }),
    prisma.project.findUniqueOrThrow({ where: { key: "CRM" } }),
  ]);
  await prisma.module.upsert({ where: { projectId_name: { projectId: project.id, name: "E2E Modul" } }, create: { projectId: project.id, name: "E2E Modul" }, update: {} });
  const last = await prisma.bug.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
  const n = (last?.number ?? 0) + 1;
  const title = `E2E triase ${Date.now()}`;
  const bug = await prisma.bug.create({
    data: { projectId: project.id, number: n, key: `CRM-${n}`, title, severity: "LOW", status: "DRAFT", reporterId: user.id, appVersion: "9.9", actualResult: "aktual", expectedResult: "harapan", stepsToReproduce: "1" },
  });

  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/projects/CRM?view=review");
  await page.getByRole("link", { name: title }).click();
  const panel = page.getByRole("complementary", { name: new RegExp(`triase CRM-${n}`) });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Severity").selectOption("HIGH");
  await panel.getByLabel("Modul").selectOption({ label: "E2E Modul" });
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("a");
  await expect(page.getByText(`CRM-${n} diterima.`)).toBeVisible();
  const after = await prisma.bug.findUniqueOrThrow({ where: { id: bug.id } });
  expect([after.status, after.severity]).toEqual(["OPEN", "HIGH"]);
  await prisma.$disconnect();
});
