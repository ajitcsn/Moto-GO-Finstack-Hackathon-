import { expect, test } from "@playwright/test";

test("every catalogue bike has a fixed model-specific photo without Wikipedia", async ({ page }) => {
  await page.route("**/w/api.php?**", route => route.abort());
  await page.goto("/explore");
  await page.getByLabel("Vehicle type", { exact: true }).selectOption("bike");
  const cards = page.getByRole("main").locator("article");
  await expect(cards).toHaveCount(29);
  for (const card of await cards.all()) {
    const image = card.locator("img").first();
    await expect(image).toBeAttached();
    await expect(image).toHaveAttribute("src", /^https:\/\/(imgd\.aeplcdn\.com|cdn\.bikedekho\.com|www\.ktmindia\.com|www\.royalenfield\.com|images\.91wheels\.com)\//);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth), { timeout: 15_000 }).toBeGreaterThan(100);
  }
});
