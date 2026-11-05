import { test, expect } from "@playwright/test";

test("AC-E2E-00 login route responds", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toBeVisible();
});
