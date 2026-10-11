import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const PDF = readFileSync(join(here, "fixtures", "sample.pdf"));
export const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: PDF });

let n = 0;
export const newPhone = () => `98${String(Date.now()).slice(-6)}${String(n++ % 100).padStart(2, "0")}`.slice(0, 10);

/** Sign up a brand-new user through the real UI (inline OTP, checkboxes) and skip the story. */
export async function signUp(page: Page, name = "E2E Rider") {
  await page.goto("/signup");
  await page.getByLabel("Mobile number or email").fill(newPhone());
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByLabel(/Display name/).fill(name);
  await page.getByLabel("I am 18 or older.").check();
  await page.getByLabel("I accept the terms and privacy notice.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: /what's your story/i })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "My Garage" })).toBeVisible();
}

/** Roadmap -> pick Hunter -> Explore financing -> F01 intake with the given amounts. */
export async function startApplication(page: Page, amount: number, quote = 165000, applicant = "Salaried") {
  await page.goto("/roadmap");
  await page.getByPlaceholder(/Search make or model/).fill("Hunter");
  await page.getByRole("option", { name: /Hunter 350/ }).click();
  await expect(page.getByRole("heading", { name: /Road to Royal Enfield Hunter 350/ })).toBeVisible();
  await page.getByRole("button", { name: /Explore financing/ }).click();
  await expect(page.getByRole("heading", { name: /Tell us about the vehicle/ })).toBeVisible();
  await page.getByLabel("City of registration").fill("Pune");
  await page.getByLabel(/On-road price quote/).fill(String(quote));
  await page.getByLabel(/Loan amount/).fill(String(amount));
  await page.getByLabel(/Your contribution/).fill(String(quote - amount));
  await page.getByLabel("Tenure (months)").selectOption("24");
  await page.getByLabel("I am", { exact: true }).selectOption({ label: applicant });
  await page.getByLabel("I am 18 or older").check();
  await page.getByRole("button", { name: "Start my application" }).click();
}

export async function fillIdentity(page: Page, pan = "ABCDE1234F") {
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await page.getByLabel(/Legal name/).fill("Asha Rao");
  await page.getByLabel("Date of birth").fill("1995-04-12");
  await page.getByLabel("Current address").fill("12 MG Road, Pune");
  await page.getByLabel("Pincode").fill("411001");
  await page.getByLabel("PAN", { exact: true }).fill(pan);
  await page.getByLabel("Employment").selectOption({ label: "Salaried (private)" });
  await page.getByLabel(/Monthly net income/).fill("55000");
  await page.getByLabel(/Existing monthly EMIs/).fill("0");
  await page.getByRole("checkbox", { name: /may process these details/ }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
}

export async function throughKycAndBureau(page: Page) {
  await expect(page.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  await page.getByLabel("Verification method").selectOption({ label: "PAN + CKYC lookup" });
  await page.getByRole("checkbox", { name: /retrieve my KYC record/ }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Credit report consent" })).toBeVisible();
  await page.getByRole("checkbox", { name: /fetch my credit report/ }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
}

export async function evidenceViaAA(page: Page) {
  await expect(page.getByRole("heading", { name: "Income evidence" })).toBeVisible();
  await page.getByLabel(/Link my bank/).check();
  await page.getByRole("checkbox", { name: /Account Aggregator/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText(/Simulated Account Aggregator/)).toBeVisible();
  await page.getByRole("button", { name: "Approve and share" }).click();
}

export async function workAndVehicle(page: Page) {
  await expect(page.getByRole("heading", { name: "Work details" })).toBeVisible();
  await page.getByLabel("Employer name").fill("Acme Corp");
  await page.getByLabel("Months with this employer").fill("30");
  await page.locator("#f-salary_slip").setInputFiles(pdf("salary-slip.pdf"));
  await expect(page.getByText("Verified. No further action needed.")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Vehicle and seller" })).toBeVisible();
  await page.getByLabel("Dealer name").fill("City Motors");
  await page.getByLabel("Variant").fill("Metro");
  await page.locator("#f-quote_document").setInputFiles(pdf("quote.pdf"));
  await expect(page.getByText("Verified. No further action needed.")).toBeVisible();
  await page.getByRole("button", { name: "Send to lender" }).click();
}

export async function toSubmission(page: Page, amount: number, quote = 165000) {
  await signUp(page);
  await startApplication(page, amount, quote);
  await fillIdentity(page);
  await throughKycAndBureau(page);
  await evidenceViaAA(page);
  await workAndVehicle(page);
}
