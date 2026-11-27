import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("test.qa@example.com").fill("step1-qa@example.test");
  await page.getByRole("button", { name: "Login Dev (Auto-create user)" }).click();
  await expect(page).toHaveURL(/\/projects/);
}

// Transisi hover tombol/tab pada modul test case harus aktif; reduced-motion mematikannya.
const probe = () => {
  const els = [...document.querySelectorAll<HTMLElement>("a, button, summary, tr")].filter((e) => /\btransition\b/.test(e.className));
  const durs = els.map((e) => getComputedStyle(e).transitionDuration);
  return { total: els.length, animated: durs.filter((d) => d.split(",").some((x) => parseFloat(x) > 0)).length };
};

test("test case: transisi aktif normal, mati saat reduced-motion", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("/projects/CRM/test-cases");
  await expect(page.getByRole("link", { name: "Test case baru", exact: true })).toBeVisible();
  const on = await page.evaluate(probe);
  expect(on.total).toBeGreaterThan(0);
  expect(on.animated).toBe(on.total);

  // hover benar-benar mengubah warna lewat transisi (bukan loncat)
  const btn = page.getByRole("link", { name: "Test case baru", exact: true });
  expect(await btn.evaluate((e) => getComputedStyle(e).transitionProperty)).not.toBe("none");
  await ctx.close();

  const rctx = await browser.newContext({ reducedMotion: "reduce" });
  const rp = await rctx.newPage();
  await login(rp);
  await rp.goto("/projects/CRM/test-cases");
  await expect(rp.getByRole("link", { name: "Test case baru", exact: true })).toBeVisible();
  const off = await rp.evaluate(probe);
  expect(off.animated).toBe(0);
  await rctx.close();
});

test("loading skeleton test case beranimasi (pulse) dan mati saat reduced-motion", async ({ browser }) => {
  for (const [rm, expectAnim] of [["no-preference", true], ["reduce", false]] as const) {
    const ctx = await browser.newContext({ reducedMotion: rm });
    const page = await ctx.newPage();
    await login(page);
    await page.route("**/projects/CRM/test-cases**", async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue(); });
    const nav = page.goto("/projects/CRM/test-cases").catch(() => {});
    const sk = page.locator(".animate-pulse").first();
    const seen = await sk.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    expect(seen).toBe(true);
    if (seen) {
      const dur = await sk.evaluate((e) => parseFloat(getComputedStyle(e).animationDuration));
      expect(dur > 0).toBe(expectAnim); // fade-in 180ms normal, 0s saat reduced-motion
    }
    await nav;
    await ctx.close();
  }
});
