import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { BugSeverity, BugStatus } from "@prisma/client";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill(email);
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
}

test("AC-BUG-08 & AC-BUG-09: Merge duplicate modal and 10-minute undo in UI", async ({ page }) => {
  const project = await prisma.project.findUniqueOrThrow({ where: { key: "CRM" } });
  const qa = await prisma.user.findUniqueOrThrow({ where: { email: "step1-qa@example.test" } });

  const lastBug = await prisma.bug.findFirst({ where: { projectId: project.id }, orderBy: { number: "desc" } });
  let nextNumber = (lastBug?.number ?? 0) + 1;
  const targetNumber = nextNumber++;
  const sourceNumber = nextNumber++;

  // 1. Target parent bug
  const targetBug = await prisma.bug.create({
    data: {
      projectId: project.id,
      number: targetNumber,
      key: `CRM-${targetNumber}`,
      title: `E2E Target Parent Bug ${targetNumber}`,
      severity: BugSeverity.HIGH,
      status: BugStatus.OPEN,
      reporterId: qa.id,
    },
  });

  // 2. Source bug to be merged
  const sourceBug = await prisma.bug.create({
    data: {
      projectId: project.id,
      number: sourceNumber,
      key: `CRM-${sourceNumber}`,
      title: `E2E Duplicate Candidate ${sourceNumber}`,
      severity: BugSeverity.MEDIUM,
      status: BugStatus.DRAFT,
      reporterId: qa.id,
      stepsToReproduce: "Step 1\nStep 2",
    },
  });

  await login(page, "step1-qa@example.test");
  await page.goto(`/projects/CRM/bugs/${sourceBug.number}`);

  // Trigger merge modal
  const mergeBtn = page.getByRole("button", { name: "Tandai duplikat & gabungkan" });
  await expect(mergeBtn).toBeVisible();
  await mergeBtn.click();

  // Dialog opens
  const dialog = page.getByRole("dialog", { name: "Tandai duplikat dan gabungkan" });
  await expect(dialog).toBeVisible();

  // Fill target bug key
  const targetInput = page.getByLabel("Bug Utama (Target)");
  await targetInput.fill(targetBug.key);

  // Submit merge
  const submitBtn = dialog.getByRole("button", { name: "Gabungkan" });
  await submitBtn.click();

  // Expect dialog closed and page reloaded with DUPLICATE status & Undo banner
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Duplikat dari", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: targetBug.key }).first()).toBeVisible();

  const undoBtn = page.getByRole("button", { name: "Urungkan gabung" });
  await expect(undoBtn).toBeVisible();

  // Click Undo
  await undoBtn.click();

  // Expect undo banner disappears, status reverts from DUPLICATE
  await expect(undoBtn).not.toBeVisible();
  await expect(page.getByText("Duplikat dari", { exact: true })).toHaveCount(0);

  // Cleanup
  await prisma.bugCoReporter.deleteMany({ where: { sourceBugId: sourceBug.id } });
  await prisma.auditLog.deleteMany({ where: { entityId: sourceBug.id } });
  await prisma.bug.deleteMany({ where: { id: { in: [sourceBug.id, targetBug.id] } } });
  await prisma.$disconnect();
});
