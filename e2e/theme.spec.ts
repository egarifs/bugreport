import { test, expect } from "@playwright/test";

test("AC-THEME-01 pilihan tema Gelap tersimpan dan dipakai sebelum render", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill("step1-qa@example.test");
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await page.waitForURL(/\/projects/);
  await page.waitForLoadState("networkidle");
  // Click can land before hydration on slow CI: retry until the menu is open.
  const trigger = page.locator('[data-testid="profile-menu-trigger"]:visible');
  const openMenu = () => expect(async () => {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await openMenu();
  await page.getByRole("button", { name: "Gelap" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openMenu();
  await page.getByRole("button", { name: "Ikut sistem" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});
