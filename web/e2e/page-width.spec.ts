import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("all four screens use fullscreen width with small consistent side gutters", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await signUp(page);
  for (const [path, title] of [["garage", "My Garage"], ["explore", "Explore"], ["forum", "Forum"], ["loans", "Loans"]]) {
    await page.goto(`/${path}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    const dimensions = await page.getByRole("main").evaluate(el => {
      const style = getComputedStyle(el);
      return { width: el.getBoundingClientRect().width, left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
    });
    expect(dimensions).toEqual({ width: 1920, left: 64, right: 64 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("main")).toHaveCSS("padding-left", "16px");
  await expect(page.getByRole("main")).toHaveCSS("padding-right", "16px");
});
