import { test, expect } from "@playwright/test";

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
