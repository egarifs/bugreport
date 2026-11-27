import { test, expect } from "@playwright/test";
import { BugStatus, PrismaClient } from "@prisma/client";
import { createBugs } from "./helpers/bugs";
import { statusLabel } from "../src/lib/status-dictionary";

// QA: label status di list (tabel), board-less detail header, dan opsi "Ubah Status" harus sama untuk setiap status.
test("status sama di list dan detail untuk semua BugStatus", async ({ page }) => {
  const prisma = new PrismaClient();
  const [project, qa] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { key: "CRM" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "step1-qa@example.test" } }),
  ]);
  const tag = `PARITY-${Date.now()}`;
  const statuses = Object.values(BugStatus);
  const bugs = await createBugs(prisma, project, statuses.map((status) => ({ title: `${tag} ${status}`, status, reporterId: qa.id })));

  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill("step1-qa@example.test");
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);

  const errors: string[] = [];
  for (const b of bugs) {
    await page.goto(`/projects/CRM?layout=list&view=all&q=${encodeURIComponent(tag)}`);
    const row = page.locator("tr", { hasText: b.title }).first();
    await expect(row).toBeVisible();
    const expected = statusLabel(b.status);
    const rowText = await row.innerText();
    if (!rowText.includes(expected)) errors.push(`LIST ${b.key} ${b.status}: want "${expected}" row="${rowText.replace(/\s+/g, " ")}"`);

    await page.goto(`/projects/CRM/bugs/${b.number}`);
    const head = await page.locator("header").first().innerText();
    if (!head.includes(expected)) errors.push(`DETAIL ${b.key} ${b.status}: want "${expected}" header="${head.replace(/\s+/g, " ")}"`);
  }
  expect(errors, errors.join("\n")).toEqual([]);

  // Opsi dropdown Ubah Status memakai label yang sama.
  await page.goto(`/projects/CRM/bugs/${bugs[1].number}`);
  const opts = await page.locator('select[name="targetStatus"] option').allInnerTexts();
  const valid = new Set(statuses.map((s) => statusLabel(s)));
  expect(opts.filter((o) => o.trim() && !valid.has(o.trim()))).toEqual([]);
  await prisma.bug.deleteMany({ where: { title: { startsWith: tag } } });
  await prisma.$disconnect();
});
