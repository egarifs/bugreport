import { test, expect } from "@playwright/test";

test.describe("mobile navigation drawer", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, traps focus, closes with Escape, and restores focus", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("test.qa@example.com").fill("ega@sismedika.com");
    await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
    await expect(page).toHaveURL(/\/projects/);
    await page.goto("/projects/CRM");

    const trigger = page.getByRole("button", { name: "Buka navigasi" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const drawer = page.getByRole("dialog", { name: "Navigasi utama" });
    await expect(page.getByRole("button", { name: "Tutup navigasi" }).first()).toHaveAttribute("aria-expanded", "true");
    await expect(drawer.getByRole("link", { name: /Bug/ })).toBeFocused();

    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const inside = await drawer.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Buka navigasi" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "Buka navigasi" })).toBeFocused();
  });
});
