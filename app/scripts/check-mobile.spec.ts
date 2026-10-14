/**
 * Phase 3 — 360px no-horizontal-scroll check on every view.
 *
 * Walks the app at 360×740 (smallest G5 viewport) and asserts the page never
 * scrolls horizontally (`document.documentElement.scrollWidth <= innerWidth`).
 * Tables/charts scroll inside their own containers — that must not leak to
 * the page. Later phases extend this file alongside golden-path.spec.ts.
 *
 * Run:  npx playwright test scripts/check-mobile.spec.ts  (or: npm run verify:mobile)
 */
import { test, expect, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const INDEX_URL = pathToFileURL(join(__dirname, "..", "out", "index.html")).href;

async function expectNoOverflow(page: Page, label: string) {
  const over = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    over.scrollWidth,
    `${label}: page scrolls horizontally (${over.scrollWidth} > ${over.innerWidth})`
  ).toBeLessThanOrEqual(over.innerWidth);
}

test("no horizontal page scroll at 360px on every view", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(INDEX_URL);
  await expect(page.getByRole("button", { name: /Work a case/ })).toBeVisible();
  await expectNoOverflow(page, "home");

  await page.getByRole("button", { name: /Work a case/ }).click();
  await expect(page.getByRole("heading", { name: "Where to focus" })).toBeVisible();
  await expectNoOverflow(page, "detect");

  // Money case: isolate carries the margin bar + ROAS/POAS table + AdTable cards.
  await page
    .getByRole("button", { name: /Work it/ })
    .nth(1)
    .click();
  await expect(page.getByRole("button", { name: "Diagnose →" })).toBeVisible();
  await expectNoOverflow(page, "case-isolate-money");

  await page.getByRole("button", { name: "Diagnose →" }).click();
  const peel = page.getByRole("button", { name: /Peel the next layer/ });
  while ((await peel.count()) > 0) await peel.first().click();
  await expectNoOverflow(page, "case-diagnose");

  await page.getByRole("button", { name: "Decide →" }).click();
  await expect(page.getByRole("button", { name: "Approve plan" })).toBeVisible();
  await expectNoOverflow(page, "case-decide");

  // Dismiss chips row (same container, must not overflow either).
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Why dismiss?")).toBeVisible();
  await expectNoOverflow(page, "case-decide-chips");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Approve plan" }).click();
  await page.getByRole("button", { name: "Open the watchlist →" }).click();
  await expect(page.getByRole("heading", { name: "Did it work?" })).toBeVisible();
  await expectNoOverflow(page, "verify");

  await page.getByRole("button", { name: /Load your CSVs/ }).click();
  await expect(page.getByRole("heading", { name: "Load your CSVs" })).toBeVisible();
  await expectNoOverflow(page, "upload");

  await page.getByRole("button", { name: "Detect", exact: true }).click();
  await page.getByTitle("Analyst settings").click();
  await expect(page.getByRole("heading", { name: "Live Analyst" })).toBeVisible();
  await expectNoOverflow(page, "analyst-dialog");
  await page.getByRole("button", { name: "Cancel" }).click();

  expect({ pageErrors, consoleErrors }).toEqual({ pageErrors: [], consoleErrors: [] });
});
