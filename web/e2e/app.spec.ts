import { expect, test } from "@playwright/test";
import { pdf, signUp, toSubmission } from "./helpers";

test("guest explores the collection without any financial prompt", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Explore first/ }).click();
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await expect(page.getByText("Exploring as a guest")).toBeVisible();
  await expect(page.getByRole("tree", { name: /Collection tree/ })).toBeVisible();
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByText(/Royal Enfield Hunter 350/).first()).toBeVisible();
  await expect(page.getByLabel(/PAN/)).toHaveCount(0);
  await expect(page.getByText(/bureau|consent/i)).toHaveCount(0);
});

test("onboarding: sign up, add a vehicle, equity is unknown until the loan is known", async ({ page }) => {
  await signUp(page);
  await expect(page.getByText("Your garage is empty")).toBeVisible();
  await page.getByRole("link", { name: "Add a vehicle" }).click();
  await page.getByPlaceholder(/Search make or model/).fill("Access");
  await page.getByRole("option", { name: /Access 125/ }).click();
  await page.getByLabel("Year").fill("2021");
  await page.getByRole("button", { name: "Save to my garage" }).click();
  await expect(page.getByRole("heading", { name: "Suzuki Access 125" })).toBeVisible();
  await expect(page.getByText("Equity unknown")).toBeVisible();
  await page.getByRole("button", { name: "No loan" }).click();
  await page.getByRole("button", { name: "Save loan details" }).click();
  await expect(page.getByText("Estimated equity")).toBeVisible();
});

test("spotting a model awards XP once, repeats earn none", async ({ page }) => {
  await signUp(page);
  await page.goto("/explore");
  await page.getByRole("button", { name: "List" }).click();
  await page.getByRole("button", { name: /Himalayan 450/ }).click();
  await page.getByRole("button", { name: "I spotted one" }).click();
  await expect(page.getByText(/Discovered! \+10 XP/)).toBeVisible();
  await page.getByRole("button", { name: /Himalayan 450/ }).click();
  await expect(page.getByRole("button", { name: /Spotted ✓/ })).toBeDisabled();
});

test("happy finance path: intake to garage handoff", async ({ page }) => {
  await toSubmission(page, 120000);
  await expect(page.getByRole("heading", { name: "Compare your offers" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("link", { name: /Read the KFS/ }).first().click();
  await expect(page.getByRole("heading", { name: "Key Facts Statement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept this offer" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /I have read the Key Facts Statement/ }).check();
  await page.getByRole("button", { name: "Accept this offer" }).click();

  await expect(page.getByRole("heading", { name: "Set up repayments" })).toBeVisible();
  await page.getByLabel("Account holder name").fill("Asha Rao");
  await page.getByLabel("Account number").fill("123456789012");
  await page.getByLabel("IFSC").fill("HDFC0001234");
  await page.getByRole("checkbox", { name: /authorise/ }).check();
  await page.getByRole("button", { name: "Set up repayments" }).click();

  await expect(page.getByRole("heading", { name: "Review and sign" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("checkbox", { name: /I have read the loan agreement/ }).check();
  await page.getByRole("button", { name: "Continue to sign" }).click();
  await page.getByLabel("OTP").fill("123456");
  await page.getByRole("button", { name: "Sign", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Paid to the dealer" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("link", { name: "See it in my Garage" }).click();
  await expect(page.getByText("Delivery pending").first()).toBeVisible();
  await expect(page.getByText("Loan outstanding")).toBeVisible();
});

test("F11 loop: lender asks for more, a needs-attention upload loops, then offers", async ({ page }) => {
  await toSubmission(page, 200000, 230000);
  await expect(page.getByRole("heading", { name: /things are needed/ })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("This is not a rejection.")).toBeVisible();
  const inputs = page.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles(pdf("slip_mismatch.pdf"));
  await expect(page.getByText(/name on the document does not match/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /things are needed/ })).toBeVisible();
  await inputs.nth(0).setInputFiles(pdf("slip-good.pdf"));
  await expect(page.getByRole("heading", { name: "One thing is needed" })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles(pdf("bill.pdf"));
  await expect(page.getByRole("heading", { name: "Compare your offers" })).toBeVisible({ timeout: 40_000 });
});

test("declined path lands on the shared recovery screen with a way forward", async ({ page }) => {
  await toSubmission(page, 300000, 330000);
  await expect(page.getByRole("heading", { name: /couldn't approve this request/ })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText(/garage, collection and plans are unaffected/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to my plan" })).toBeVisible();
});

test("declining the credit report consent is not a dead end", async ({ page }) => {
  await signUp(page);
  const { startApplication, fillIdentity } = await import("./helpers");
  await startApplication(page, 120000);
  await fillIdentity(page);
  await page.getByLabel("Verification method").selectOption({ label: "PAN + CKYC lookup" });
  await page.getByRole("checkbox", { name: /retrieve my KYC record/ }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByRole("button", { name: "No thanks" }).click();
  await expect(page.getByRole("heading", { name: /without the credit report/ })).toBeVisible();
  await page.getByRole("link", { name: /Resume at the credit report step/ }).click();
  await expect(page.getByRole("heading", { name: "Credit report consent" })).toBeVisible();
});
