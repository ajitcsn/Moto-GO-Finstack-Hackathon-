import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

const photo = { name: "sighting.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=", "base64") };

test("photo selection, catalogue tap and logging save a sighting exactly once", async ({ page }) => {
  await signUp(page);
  await page.goto("/explore");
  const capture = page.getByRole("region", { name: "Capture a sighting" });
  const log = capture.getByRole("button", { name: "Log sighting · +50" });
  await expect(log).toBeDisabled();
  await page.locator("#explore-photo").setInputFiles(photo);
  await expect(capture.getByRole("button", { name: "Cancel selection" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Explore financing for/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Select Hero Splendor+ for sighting", exact: true }).click();
  await expect(capture).toContainText("Selected: Hero Splendor+");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(log).toBeEnabled();
  await log.click();
  await expect(page.getByText("Sighting saved · +50 points", { exact: true })).toBeVisible();
  await expect(log).toBeDisabled();
  await expect(page.getByRole("button", { name: "Explore Hero Splendor+", exact: true })).toContainText("SPOTTED");
  await page.locator("#explore-photo").setInputFiles(photo);
  await expect(log).toBeEnabled();
  await log.click();
  await expect(page.getByText("Already spotted. No repeat points.", { exact: true })).toBeVisible();
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(me.xp).toBe(50);
});

test("selection works without a photo and can be cancelled or changed", async ({ page }) => {
  await page.goto("/explore");
  const capture = page.getByRole("region", { name: "Capture a sighting" });
  await capture.getByRole("button", { name: "Select vehicle below" }).click();
  await page.getByLabel("Search vehicles", { exact: true }).fill("Raider");
  await expect(page.getByRole("button", { name: "Select for sighting", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Select for sighting", exact: true }).click();
  await expect(capture).toContainText("Selected: TVS Raider 125");
  await expect(capture).toContainText("Take or choose a photo to enable Log sighting");
  await capture.getByRole("button", { name: "Change vehicle" }).click();
  await capture.getByRole("button", { name: "Cancel selection" }).click();
  await expect(page.getByRole("button", { name: "Explore TVS Raider 125", exact: true })).toBeVisible();
  await expect(capture).toContainText("Selected: TVS Raider 125");
});
