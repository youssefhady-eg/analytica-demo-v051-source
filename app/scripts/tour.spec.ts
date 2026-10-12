/**
 * Phase 4 — presenter-mode end-to-end on file://.
 *
 * Runs both tracks step by step (zero pageerror/console.error/failed
 * requests), asserts the tour drives the real app (views, stages, peels,
 * approvals, dispositions, reset), exiting mid-tour leaves the app usable,
 * and the tour works at 360px.
 *
 * Run:  npx playwright test scripts/tour.spec.ts  (or: npm run verify:tour)
 */
import { test, expect, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const INDEX_URL = pathToFileURL(join(__dirname, "..", "out", "index.html")).href;

function watchErrors(page: Page) {
  const bag = { pageErrors: [] as string[], consoleErrors: [] as string[], failed: [] as string[] };
  page.on("pageerror", (e) => bag.pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") bag.consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => bag.failed.push(`${r.method()} ${r.url()}`));
  return bag;
}

function expectClean(bag: ReturnType<typeof watchErrors>) {
  expect(bag).toEqual({ pageErrors: [], consoleErrors: [], failed: [] });
}

async function startTrack(page: Page, track: "Vondera track" | "Marketer track") {
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Present" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(track) }).first().click();
  await expect(page.getByRole("region", { name: "Presenter coach" })).toBeVisible();
}

async function stepTo(page: Page, n: number, total = 10) {
  await expect(page.getByText(`Step ${n} of ${total}`)).toBeVisible();
}

test("vondera track end-to-end on file://", async ({ page }) => {
  const bag = watchErrors(page);
  await page.goto(INDEX_URL);
  await startTrack(page, "Vondera track");

  // 1-2 home.
  await stepTo(page, 1);
  await expect(page.getByText("Analytica turns Vondera's data into an investigation")).toBeVisible();
  await expect(page.locator('[data-tour="home-hero"].tour-spotlight')).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // 2 ecosystem.
  await stepTo(page, 2);
  await expect(page.locator('[data-tour="home-ecosystem"].tour-spotlight')).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // 3-4 detect with computed captions.
  await stepTo(page, 3);
  await expect(page.getByText(/The platform says .*\. After costs it earns/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await stepTo(page, 4);
  await expect(page.getByText(/cases, ranked by money/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // 5 diagnose peeled by the tour.
  await stepTo(page, 5);
  await expect(page.getByText("Peel the next layer")).toHaveCount(0);
  await page.getByRole("button", { name: "Next" }).click();

  // 6 approve-top lands on Verify with the card.
  await stepTo(page, 6);
  await expect(page.getByRole("heading", { name: "Did it work?" })).toBeVisible();
  await expect(page.getByText(/at stake — watching for recovery/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // 7-9 provenance / upload / ask-roadmap.
  await stepTo(page, 7);
  await expect(page.getByText(/tagged rules or/)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await stepTo(page, 8);
  await expect(page.getByRole("heading", { name: "Load your CSVs" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await stepTo(page, 9);
  await expect(page.getByText("Ask questions in plain words")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // 10 reset returns the initial state.
  await stepTo(page, 10);
  await page.getByRole("button", { name: "Exit" }).click();
  await expect(page.getByRole("region", { name: "Presenter coach" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Where to focus" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Work it/ })).toHaveCount(4);
  await expect(page.getByRole("button", { name: /Verify \(\d+\)/ })).toHaveCount(0);

  expectClean(bag);
});

test("marketer track end-to-end on file://", async ({ page }) => {
  const bag = watchErrors(page);
  await page.goto(INDEX_URL);
  await startTrack(page, "Marketer track");

  await stepTo(page, 1);
  await expect(page.getByText(/Start where the money is:/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // 2-4 the top case, isolate → diagnose (peeled) → decide.
  await stepTo(page, 2);
  await expect(page.getByRole("button", { name: "Diagnose →" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await stepTo(page, 3);
  await expect(page.getByText("Peel the next layer")).toHaveCount(0);
  await page.getByRole("button", { name: "Next" }).click();
  await stepTo(page, 4);
  await expect(page.getByText("PENDING APPROVAL")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // 5 snooze-top + expanded log; simulate re-surfaces.
  await stepTo(page, 5);
  await expect(page.getByText("Handled & snoozed (1)")).toBeVisible();
  await page.getByRole("button", { name: "Simulate worsening (demo)" }).click();
  await expect(page.getByText(/Re-surfaced/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // 6 disagree-top is logged for the Analyst.
  await stepTo(page, 6);
  await expect(page.getByText(/You've overridden 1 of my reads/)).toBeVisible();
  await page.keyboard.press("Escape");
  // Esc exits mid-tour; the app stays usable with tour state intact.
  await expect(page.getByRole("region", { name: "Presenter coach" })).toHaveCount(0);
  await page.getByRole("button", { name: /Work it/ }).first().click();
  await expect(page.getByRole("button", { name: "Diagnose →" })).toBeVisible();

  expectClean(bag);
});

test("tour works at 360px", async ({ page }) => {
  const bag = watchErrors(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(INDEX_URL);
  await startTrack(page, "Vondera track");
  await stepTo(page, 1);
  for (let n = 2; n <= 6; n++) {
    await page.getByRole("button", { name: "Next" }).click();
    await stepTo(page, n);
  }
  await expect(page.getByRole("heading", { name: "Did it work?" })).toBeVisible();
  const over = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(over.sw).toBeLessThanOrEqual(over.iw);
  expectClean(bag);
});
