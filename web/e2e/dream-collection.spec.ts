import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("six saved dreams display only one premium bike and one premium car without losing saves", async ({ page }) => {
  await signUp(page);
  const csrf = (await page.context().cookies()).find(c => c.name === "mf_csrf")!.value;
  const headers = { "X-CSRF-Token": csrf };
  const owned = await page.request.post("/api/v1/vehicles", { headers, data: { type: "scooter", model_id: "suzuki-access-125", year: 2021, ownership: "current" } });
  expect(owned.status()).toBe(201);
  const ownedVehicle = await owned.json();
  const ids = ["honda-activa-6g", "hero-splendorplus", "triumph-speed-400", "ktm-duke-390", "maruti-suzuki-swift", "tata-nexon-ev"];
  for (const model_id of ids) {
    const saved = await page.request.post("/api/v1/activities", { headers, data: { model_id, activity: "saved" } });
    expect(saved.ok()).toBe(true);
  }
  await page.goto("/garage");
  const dreams = page.locator("#dream-garage");
  await expect(dreams.getByRole("article")).toHaveCount(2);
  await expect(dreams.getByText("Dream bike", { exact: true })).toHaveCount(1);
  await expect(dreams.getByText("Dream car", { exact: true })).toHaveCount(1);
  await expect(dreams.getByRole("heading", { name: "KTM Duke 390", exact: true })).toBeVisible();
  await expect(dreams.getByRole("heading", { name: "Tata Nexon EV", exact: true })).toBeVisible();
  await expect(dreams.getByText("Dream suggestions", { exact: true })).toHaveCount(0);
  const catalogue = await (await page.request.get("/api/v1/catalogue/models?ids=ktm-duke-390,tata-nexon-ev")).json();
  expect(catalogue.items.every((m: { price_low: number }) => m.price_low >= ownedVehicle.valuation.high * 2)).toBe(true);
  const saved = await (await page.request.get("/api/v1/dream-garage")).json();
  expect(saved.items).toHaveLength(6);
});
