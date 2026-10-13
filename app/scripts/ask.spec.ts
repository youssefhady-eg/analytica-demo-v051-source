/**
 * Phase 5 — Ask panel end-to-end on file://.
 *
 * Opens the drawer, asks every suggested chip (each answer carries a rules
 * badge, an "Answered from" line and follow-ups), opens a case from an
 * answer, checks the fallback + action guard via typed input, and closes
 * with Esc. Zero pageerror/console.error/failed requests.
 *
 * Run:  npx playwright test scripts/ask.spec.ts  (or: npm run verify:ask)
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

async function openAsk(page: Page) {
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Ask Vondera" })).toBeVisible();
  await expect(page.getByText("demo · answers from computed metrics")).toBeVisible();
}

test("ask panel on file://", async ({ page }) => {
  const bag = watchErrors(page);
  await page.goto(INDEX_URL);
  await openAsk(page);
  const drawer = page.getByRole("dialog", { name: "Ask Vondera" });

  // Ask every suggested chip (via input — the chip block retires after the
  // first answer); each answer is rules-badged with provenance.
  const chips = await drawer
    .getByText("Try one of these")
    .locator("..")
    .getByRole("button")
    .allTextContents();
  expect(chips.length).toBeGreaterThanOrEqual(3);
  const input0 = drawer.getByLabel("Ask about your numbers");
  const askBtn = drawer.getByRole("button", { name: "Ask", exact: true });
  for (let i = 0; i < chips.length; i++) {
    await input0.fill(chips[i]);
    await askBtn.click();
    await expect(drawer.getByText("Answered from:").nth(i)).toBeVisible();
  }
  await expect(drawer.getByText("rules").first()).toBeVisible();

  // Open a case from an answer (focus answer links the top case).
  await drawer.getByRole("button", { name: "Open case →" }).first().click();
  await expect(page.getByRole("button", { name: "Diagnose →" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Ask Vondera" })).toHaveCount(0);

  // Fallback + action guard via typed input.
  await openAsk(page);
  const input = drawer.getByLabel("Ask about your numbers");
  await input.fill("tell me a joke about cats");
  await drawer.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(drawer.getByText("I can only answer from the metrics on screen. Try one of these:")).toBeVisible();
  await input.fill("pause that ad");
  await drawer.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(drawer.getByText(/I can recommend, but I don't take actions/)).toBeVisible();
  await input.fill("approve the top case");
  await drawer.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(drawer.getByText(/I can recommend, but I don't take actions/).nth(1)).toBeVisible();

  // Asking never acts: Verify's count is unchanged and nothing left triage.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Ask Vondera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Verify \(\d+\)/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Detect", exact: true }).click();
  await expect(page.getByRole("button", { name: /Work it/ })).toHaveCount(4);
  await openAsk(page);

  // Clear wipes the history; Esc closes the drawer.
  await drawer.getByRole("button", { name: "Clear" }).click();
  await expect(drawer.getByText("Try one of these")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Ask Vondera" })).toHaveCount(0);

  expect(bag).toEqual({ pageErrors: [], consoleErrors: [], failed: [] });
});
