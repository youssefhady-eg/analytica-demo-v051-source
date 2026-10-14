/**
 * Phase 6 — hardening end-to-end on file://.
 *
 * - Row problems name file + row in the Couldn't-load card.
 * - Template downloads work from file:// (filenames + headers checked).
 * - A synthetic 200k-row orders export parses without freezing: the progress
 *   UI appears and the app stays clickable mid-parse, then loads.
 *
 * Run:  npx playwright test scripts/hardening.spec.ts (or: npm run verify:hardening)
 */
import { test, expect, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const INDEX_URL = pathToFileURL(join(__dirname, "..", "out", "index.html")).href;
const FIX = join(__dirname, "fixtures", "csv");

function watchErrors(page: Page) {
  const bag = { pageErrors: [] as string[], consoleErrors: [] as string[], failed: [] as string[] };
  page.on("pageerror", (e) => bag.pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") bag.consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => bag.failed.push(`${r.method()} ${r.url()}`));
  return bag;
}

async function gotoUpload(page: Page) {
  await page.goto(INDEX_URL);
  await page.getByRole("button", { name: /Load your CSVs/ }).click();
  await expect(page.getByRole("heading", { name: "Load your CSVs" })).toBeVisible();
}

test("row problems name file and row on file://", async ({ page }) => {
  const bag = watchErrors(page);
  await gotoUpload(page);
  const files = page.locator('input[type="file"]');
  await files.nth(0).setInputFiles(join(FIX, "spend-clean.csv"));
  await files.nth(1).setInputFiles(join(FIX, "orders-issues.csv"));
  await page.getByRole("button", { name: "Compute & load into demo →" }).click();
  await expect(page.getByRole("heading", { name: "Couldn't load" })).toBeVisible();
  // Unreadable value names file + row. (Compute-level problems surface once
  // parse is clean — covered by the second upload below.)
  await expect(page.getByText("orders.csv row 6")).toBeVisible();
  await expect(page.getByText("abc")).toBeVisible();

  await page.goto(INDEX_URL);
  await page.getByRole("button", { name: /Load your CSVs/ }).click();
  const files2 = page.locator('input[type="file"]');
  await files2.nth(0).setInputFiles(join(FIX, "spend-clean.csv"));
  await files2.nth(1).setInputFiles(join(FIX, "orders-status-only.csv"));
  await page.getByRole("button", { name: "Compute & load into demo →" }).click();
  await expect(page.getByRole("heading", { name: "Couldn't load" })).toBeVisible();
  await expect(page.getByText("orders.csv row 3")).toBeVisible();
  await expect(page.getByText("lost")).toBeVisible();
  expect(bag).toEqual({ pageErrors: [], consoleErrors: [], failed: [] });
});

test("template downloads work from file://", async ({ page }) => {
  const bag = watchErrors(page);
  await gotoUpload(page);
  await expect(page.getByRole("button", { name: "Download template CSVs" })).toBeVisible();

  const seen: { name: string; header: string }[] = [];
  page.on("download", async (dl) => {
    const path = await dl.path();
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(path, "utf8");
    seen.push({ name: dl.suggestedFilename(), header: text.split("\n")[0] ?? "" });
  });
  await page.getByRole("button", { name: "Download template CSVs" }).click();
  await expect.poll(() => seen.length, { timeout: 15000 }).toBe(5);
  const byName: Record<string, string> = {};
  for (const s of seen) byName[s.name] = s.header;
  expect(byName["spend.csv"]).toContain("adset_id");
  expect(byName["spend.csv"]).toContain("spend_egp");
  expect(byName["orders.csv"]).toContain("courier_status");
  expect(byName["ads.csv"]).toContain("ctr_now");
  expect(byName["daily_adset.csv"]).toContain("failed_delivery_rate_pct");
  expect(byName["funnel.csv"]).toContain("count");

  await page.getByRole("button", { name: "Download sample as CSVs" }).click();
  await expect.poll(() => seen.length, { timeout: 15000 }).toBe(10);
  expect(seen.some((s) => s.name === "sample-orders.csv")).toBe(true);
  expect(bag).toEqual({ pageErrors: [], consoleErrors: [], failed: [] });
});

test("200k-row export parses without freezing on file://", async ({ page }) => {
  test.setTimeout(180000);
  const bag = watchErrors(page);
  await gotoUpload(page);

  // Synthetic merchant-scale export, generated in-test (never committed).
  const ROWS = 200000;
  const lines = ["order_id,adset_id,order_value_egp,courier_status"];
  for (let i = 0; i < ROWS; i++) {
    lines.push(`o${i},p1,800,${i % 50 === 0 ? "refused" : "delivered"}`);
  }
  const big = { name: "orders.csv", mimeType: "text/csv", buffer: Buffer.from(lines.join("\n")) };
  const small = {
    name: "spend.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "adset_id,adset_name,channel,spend_egp,platform_roas\np1,Big One,meta,100000,3.0\n"
    ),
  };
  const files = page.locator('input[type="file"]');
  await files.nth(0).setInputFiles(small);
  await files.nth(1).setInputFiles(big);
  await page.getByRole("button", { name: "Compute & load into demo →" }).click();

  // Progress UI appears; Cancel works mid-run and keeps the old data.
  await expect(page.getByText(/Parsing|Computing/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Compute cancelled")).toBeVisible();
  await expect(page.getByText(/the fictional sample/)).toBeVisible();

  // Re-run to completion: the UI stays interactive mid-parse (typing works),
  // then the 200k rows load.
  await page.getByPlaceholder("e.g. InYourShoe").fill("Big Brand");
  await page.getByRole("button", { name: "Compute & load into demo →" }).click();
  await expect(page.getByText(/Parsing|Computing/)).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder("e.g. InYourShoe").fill("Big Brand live");
  await expect(page.getByPlaceholder("e.g. InYourShoe")).toHaveValue("Big Brand live");
  await expect(page.getByRole("button", { name: /Walk through Big Brand/ })).toBeVisible({
    timeout: 120000,
  });
  await expect(page.getByText(/200,000 rows/)).toBeVisible();
  await page.getByRole("button", { name: /Walk through Big Brand/ }).click();
  await expect(page.getByText("YOUR DATA — Big Brand")).toBeVisible();
  expect(bag).toEqual({ pageErrors: [], consoleErrors: [], failed: [] });
});
