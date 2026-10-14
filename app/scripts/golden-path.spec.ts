/**
 * Phase 0 — G3 file:// runtime: golden-path walkthrough.
 *
 * Opens the static export straight from `file://` (no server) and walks:
 * Home → "Work a case" → open rank 1 → Isolate → "Diagnose →" → peel all
 * layers → "Decide →" → "Approve plan" → "Open the watchlist →" → Verify
 * shows the card → nav to Upload → nav back to Detect with the watchlist
 * count intact → open the ✨ dialog, then Cancel.
 *
 * Asserts zero `pageerror`, zero `console.error`, zero failed requests.
 * Later phases extend this file (brief §5.4: "Later phases extend this file").
 *
 * Phase 2 adds the dismiss-reason flow test below the golden path.
 *
 * Run:  npx playwright test scripts/golden-path.spec.ts  (or: npm run verify:file)
 */
import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const INDEX_URL = pathToFileURL(join(__dirname, "..", "out", "index.html")).href;

test("golden path on file://", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];

  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => failedRequests.push(`${r.method()} ${r.url()}`));
  page.on("response", (r) => {
    if (!r.ok()) badResponses.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(INDEX_URL);
  // Home
  await expect(page.getByRole("button", { name: /Work a case/ })).toBeVisible();

  // Home → Detect ("Work a case")
  await page.getByRole("button", { name: /Work a case/ }).click();
  await expect(page.getByRole("heading", { name: "Where to focus" })).toBeVisible();
  const workIt = page.getByRole("button", { name: /Work it/ });
  await expect(workIt.first()).toBeVisible();
  expect(await workIt.count()).toBe(4);

  // Open rank 1 → Isolate
  await workIt.first().click();
  await expect(page.getByRole("button", { name: "Diagnose →" })).toBeVisible();

  // Phase 1 (P1-03): stepper Detect pill backs out; Verify pill locked pre-approval.
  const stepper = page.locator("ol.mb-6");
  await expect(stepper.getByRole("button", { name: "1 Detect" })).toBeVisible();
  await expect(stepper.getByRole("button", { name: /Verify/ })).toHaveCount(0);
  await stepper.getByRole("button", { name: "1 Detect" }).click();
  await expect(page.getByRole("heading", { name: "Where to focus" })).toBeVisible();

  // Re-open rank 1 and continue the path.
  await workIt.first().click();
  await expect(page.getByRole("button", { name: "Diagnose →" })).toBeVisible();

  // Isolate → Diagnose, peel all layers
  await page.getByRole("button", { name: "Diagnose →" }).click();
  const peel = page.getByRole("button", { name: /Peel the next layer/ });
  while ((await peel.count()) > 0) {
    await peel.first().click();
  }

  // Diagnose → Decide → approve → watchlist
  await page.getByRole("button", { name: "Decide →" }).click();
  await page.getByRole("button", { name: "Approve plan" }).click();
  // Phase 1 (P1-03/P1-04): Verify pill unlocks on approval; note follows state.
  await expect(page.locator("ol.mb-6").getByRole("button", { name: /Verify/ })).toBeVisible();
  await expect(page.getByText(/Approved — recovering the purchase volume/)).toBeVisible();
  await page.getByRole("button", { name: "Open the watchlist →" }).click();

  // Verify shows the approved card
  await expect(page.getByRole("heading", { name: "Did it work?" })).toBeVisible();
  await expect(page.getByText(/at stake — watching for recovery/)).toBeVisible();

  // Nav to Upload, then back to Detect with the watchlist count intact
  await page.getByRole("button", { name: /Load your CSVs/ }).click();
  await expect(page.getByRole("heading", { name: "Load your CSVs" })).toBeVisible();
  await page.getByRole("button", { name: "Detect", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Where to focus" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Verify \(\d+\)/ })).toBeVisible();

  // Open the ✨ dialog, then Cancel
  await page.getByTitle("Analyst settings").click();
  await expect(page.getByRole("heading", { name: "Live Analyst" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Live Analyst" })).toHaveCount(0);

  // Phase 1: the approved case left the waiting list (Detect), lives on Verify.
  await expect(page.getByRole("button", { name: /Work it/ })).toHaveCount(3);
  await expect(page.getByText("TikTok Checkout → Purchase leak")).toHaveCount(0);
  await page.getByRole("button", { name: "1 on the watchlist →" }).click();
  await expect(page.getByRole("heading", { name: "Did it work?" })).toBeVisible();
  await expect(page.getByText("TikTok Checkout → Purchase leak")).toBeVisible();

  expect({ pageErrors, consoleErrors, failedRequests, badResponses }).toEqual({
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    badResponses: [],
  });
});

test("skipped detectors with funnel-less CSV on file://", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => failedRequests.push(`${r.method()} ${r.url()}`));

  await page.goto(INDEX_URL);
  await page.getByRole("button", { name: /Load your CSVs/ }).click();
  await expect(page.getByRole("heading", { name: "Load your CSVs" })).toBeVisible();

  // Funnel-less, daily-less merchant export: spend + orders only.
  const files = page.locator('input[type="file"]');
  await files.nth(0).setInputFiles(join(__dirname, "fixtures", "no-funnel", "spend.csv"));
  await files.nth(1).setInputFiles(join(__dirname, "fixtures", "no-funnel", "orders.csv"));
  await expect(files.nth(0)).toBeVisible();
  await page.getByPlaceholder("e.g. InYourShoe").fill("Fixture Brand");
  await page.getByRole("button", { name: "Compute & load into demo →" }).click();
  await page.getByRole("button", { name: /Walk through Fixture Brand/ }).click();

  // Detect on fixture data: the offender case ranks, skipped checks are named.
  await expect(page.getByRole("heading", { name: "Where to focus" })).toBeVisible();
  await expect(page.getByText("Prospecting One looks profitable, loses money")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Some checks couldn't run" })).toBeVisible();
  await expect(page.getByText("daily_adset.csv not loaded")).toBeVisible();
  await expect(page.getByText("funnel.csv not loaded")).toBeVisible();
  // No false "all quiet" while a case waits.
  await expect(page.getByText("All quiet")).toHaveCount(0);

  // The skipped-check action routes back to the uploader.
  await page.getByRole("button", { name: "↑ Load funnel.csv" }).click();
  await expect(page.getByRole("heading", { name: "Load your CSVs" })).toBeVisible();

  expect({ pageErrors, consoleErrors, failedRequests }).toEqual({
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
  });
});

test("dismiss-reason flow on file://", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("requestfailed", (r) => failedRequests.push(`${r.method()} ${r.url()}`));

  const workIt = page.getByRole("button", { name: /Work it/ });
  const openRank = async (n: number) => {
    await workIt.nth(n).click();
    await page.getByRole("button", { name: "Diagnose →" }).click();
    await page.getByRole("button", { name: "Decide →" }).click();
    await expect(page.getByRole("button", { name: "Approve plan" })).toBeVisible();
  };
  const backToDetect = async () => {
    await page.getByRole("button", { name: "Detect", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Where to focus" })).toBeVisible();
  };

  await page.goto(INDEX_URL);
  await page.getByRole("button", { name: /Work a case/ }).click();
  await expect(workIt).toHaveCount(4);

  // --- Not now (snooze): chip commits, pill + sentence + Undo/Back appear. ---
  await openRank(1);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Why dismiss?")).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByText("SNOOZED", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Snoozed. I'll bring it back if the numbers get worse.")
  ).toBeVisible();
  // Back/Next preserves: leave via the case Back, come back to Decide.
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Decide →" })).toBeVisible();
  await page.getByRole("button", { name: "Decide →" }).click();
  await expect(page.getByText("SNOOZED", { exact: true })).toBeVisible();
  // Snoozed case left the waiting list; the log carries it with its snapshot.
  await backToDetect();
  await expect(workIt).toHaveCount(3);
  // The title now lives only in the handled log (the waiting card is gone).
  await expect(page.getByText("Lookalike – Purchasers looks profitable, loses money")).toHaveCount(
    1
  );
  await expect(page.getByText("Handled & snoozed (1)")).toBeVisible();
  await page.getByText("Handled & snoozed (1)").click();
  await expect(page.getByText("snoozed").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Simulate worsening (demo)" })).toBeVisible();
  // Undo restores the case at its original rank.
  await page.getByText("Lookalike – Purchasers looks profitable, loses money").click();
  await page.getByRole("button", { name: "Diagnose →" }).click();
  await expect(page.getByRole("button", { name: "Decide →" })).toBeVisible();
  await page.getByRole("button", { name: "Decide →" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Approve plan" })).toBeVisible();
  await backToDetect();
  await expect(workIt).toHaveCount(4);
  await expect(page.getByText("Handled & snoozed (1)")).toHaveCount(0);

  // --- Disagree (override): logged, reaches the Analyst note + pill. ---
  await openRank(2);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByRole("button", { name: "Disagree" }).click();
  await expect(page.getByText("OVERRIDE LOGGED", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Noted — I've logged that you disagree with my read on this one.")
  ).toBeVisible();
  await expect(
    page.getByText("You disagreed with me on this one. I've kept your call.")
  ).toBeVisible();
  await backToDetect();
  await expect(workIt).toHaveCount(3);
  await expect(page.getByText("You've overridden 1 of my reads — I've logged them.")).toBeVisible();
  await page.getByText("Handled & snoozed (1)").click();
  await expect(page.getByText("your override")).toBeVisible();

  // --- Already handled (resolved): permanent, all-handled when all are gone. ---
  await openRank(2);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByRole("button", { name: "Already handled" }).click();
  await expect(page.getByText("RESOLVED", { exact: true })).toBeVisible();
  await expect(page.getByText("Marked as handled — it's out of your triage list.")).toBeVisible();
  await backToDetect();
  await expect(workIt).toHaveCount(2);

  // --- Simulate worsening: the snoozed case re-surfaces with the marker. ---
  await openRank(1);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByRole("button", { name: "Not now" }).click();
  await backToDetect();
  await expect(workIt).toHaveCount(1);
  await page.getByText(/Handled & snoozed \(\d+\)/).click();
  await page.getByRole("button", { name: "Simulate worsening (demo)" }).click();
  await expect(workIt).toHaveCount(2);
  await expect(page.getByText("↻ Re-surfaced — worsened since snoozed")).toBeVisible();
  // Approve-after-snooze clears the disposition onto the watchlist.
  await page.getByText("Lookalike – Purchasers looks profitable, loses money").click();
  await page.getByRole("button", { name: "Diagnose →" }).click();
  await expect(page.getByRole("button", { name: "Decide →" })).toBeVisible();
  await page.getByRole("button", { name: "Decide →" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Approve plan" }).click();
  await page.getByRole("button", { name: "Open the watchlist →" }).click();
  await expect(page.getByRole("heading", { name: "Did it work?" })).toBeVisible();
  await expect(
    page.getByText("Lookalike – Purchasers looks profitable, loses money")
  ).toBeVisible();

  expect({ pageErrors, consoleErrors, failedRequests }).toEqual({
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
  });
});
