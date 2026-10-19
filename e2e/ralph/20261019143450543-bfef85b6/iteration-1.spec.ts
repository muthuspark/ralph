import { test, expect, type Page } from "@playwright/test";
import { progressPage } from "../../../ralph-server-page.js";

type Entry = { timestamp: string; run: string; event: string; details: unknown };
const stoppedEvent = "Run stopped; changes preserved";
const heading = "Run stopped · changes preserved";

function entry(run: string, event: string, details: unknown, sequence: number): Entry {
  return { timestamp: new Date(Date.UTC(2026, 9, 19, 12, 0, sequence)).toISOString(), run, event, details };
}

function stoppedRun(run: string, error: string, resume: string, sequence = 0): Entry[] {
  return [
    entry(run, "Run started", { goal: `Test-owned ${run}`, iterations: 2 }, sequence),
    entry(run, stoppedEvent, { error, pendingPhase: "verify", resume }, sequence + 1),
  ];
}

// The host base URL can serve a different app. Load the production viewer export
// that startProgressServer serves, then substitute only test-owned log data.
// No progress file, run state, command endpoint, or server environment is modified.
async function logFixture(page: Page, initial: Entry[]) {
  let entries = initial;
  await page.route(url => url.pathname === "/", async route => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      headers: {
        "cache-control": "no-store",
        "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      },
      body: progressPage,
    });
  });
  await page.route("**/api/progress", async route => {
    const text = entries.map(item => `\n[${item.timestamp}] ${item.run} — ${item.event}\n${JSON.stringify(item.details)}\n`).join("");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ file: "/test-owned/progress.txt", exists: true, text, entries }),
    });
  });
  return (next: Entry[]) => { entries = next; };
}

function recovery(page: Page) {
  return page.getByRole("main").getByRole("region", { name: heading, exact: true });
}

async function expectRecovery(page: Page, error: string, phase: string, command: string) {
  const panel = recovery(page);
  await expect(panel).toBeVisible();
  const definitions = panel.locator("dd");
  await expect(definitions).toHaveCount(3);
  await expect(definitions.nth(0)).toHaveText(error);
  await expect(definitions.nth(1)).toHaveText(phase);
  await expect(definitions.nth(2)).toHaveText(command);
  await expect(panel.locator("pre")).toHaveText(command);
  await expect(page.getByRole("main").locator("#events details[open]")).toHaveCount(0);
}

test("stopped run exposes exact recovery details above the timeline, including after reload", async ({ page }) => {
  const error = "Verification failed: expected the recovery panel to be visible";
  const command = 'npx ralph resume --run "fixture-stopped"';
  await logFixture(page, stoppedRun("fixture-stopped", error, command));
  await page.goto("/");
  await expectRecovery(page, error, "verify", command);
  const panelBounds = await recovery(page).boundingBox();
  const activityBounds = await page.getByRole("heading", { name: "Activity", exact: true }).boundingBox();
  expect(panelBounds).not.toBeNull();
  expect(activityBounds).not.toBeNull();
  expect(panelBounds!.y + panelBounds!.height).toBeLessThanOrEqual(activityBounds!.y);
  await page.reload();
  await expectRecovery(page, error, "verify", command);
});

test("switching runs isolates recovery details and All runs summarizes the newest run", async ({ page }) => {
  const firstError = "Fixture A: lint failed";
  const secondError = "Fixture B: repair budget exhausted";
  const firstCommand = "npx ralph resume --run fixture-a";
  const secondCommand = "npx ralph resume --run fixture-b";
  await logFixture(page, [
    ...stoppedRun("fixture-a", firstError, firstCommand),
    ...stoppedRun("fixture-b", secondError, secondCommand, 2),
  ]);
  await page.goto("/");
  const run = page.getByRole("combobox", { name: "Run", exact: true });
  await expect(run).toHaveValue("fixture-b");
  await expectRecovery(page, secondError, "verify", secondCommand);
  await run.selectOption("fixture-a");
  await expectRecovery(page, firstError, "verify", firstCommand);
  await expect(page.getByRole("main").getByText(secondError, { exact: true })).not.toBeVisible();
  await expect(page.getByRole("main").getByText(secondCommand, { exact: true })).not.toBeVisible();
  await run.selectOption("fixture-b");
  await expectRecovery(page, secondError, "verify", secondCommand);
  await expect(page.getByRole("main").getByText(firstError, { exact: true })).not.toBeVisible();
  await expect(page.getByRole("main").getByText(firstCommand, { exact: true })).not.toBeVisible();
  await run.selectOption("");
  await expectRecovery(page, secondError, "verify", secondCommand);
  await expect(recovery(page)).not.toContainText(firstError);
  await expect(recovery(page)).not.toContainText(firstCommand);
});

for (const nextEvent of ["Run resumed", "Phase started"]) {
  test(`${nextEvent} clears obsolete recovery details on the next live update`, async ({ page }) => {
    const error = "Fixture live update: stopped verification";
    const command = "npx ralph resume --run fixture-live";
    const entries = stoppedRun("fixture-live", error, command);
    const update = await logFixture(page, entries);
    await page.goto("/");
    await expectRecovery(page, error, "verify", command);
    update([...entries, entry("fixture-live", nextEvent, { phase: "verify", iteration: 1 }, 2)]);
    await expect(page.getByRole("main").locator("#latest")).toHaveText(nextEvent);
    await expect(recovery(page)).toBeHidden();
    await expect(page.getByRole("main").getByRole("heading", { name: heading, exact: true })).toBeHidden();
    // Historical events remain available, but no obsolete command is exposed in the summary.
    await expect(page.getByRole("main").locator("#recovery-details")).toBeEmpty();
    await expect(page.getByRole("main").locator("#events .entry")).toHaveCount(3);
    await page.reload();
    await expect(page.getByRole("main").locator("#latest")).toHaveText(nextEvent);
    await expect(recovery(page)).toBeHidden();
  });
}

test("missing and unusable recovery fields provide readable fallbacks", async ({ page }) => {
  await logFixture(page, [
    entry("fixture-missing", stoppedEvent, {}, 0),
    entry("fixture-invalid", stoppedEvent, { error: null, pendingPhase: "  ", resume: { command: "never execute" } }, 1),
  ]);
  await page.goto("/");
  for (const run of ["fixture-invalid", "fixture-missing"]) {
    await page.getByRole("combobox", { name: "Run", exact: true }).selectOption(run);
    const panel = recovery(page);
    await expect(panel).toBeVisible();
    await expect(panel.locator("dd")).toHaveText([
      "No error recorded.", "No pending phase recorded.", "No resume command recorded.",
    ]);
    await expect(panel).not.toContainText("undefined");
    await expect(panel).not.toContainText("[object Object]");
    await expect(page.getByRole("main").locator("#events details[open]")).toHaveCount(0);
  }
});

test("recovery values render as inert text without executable controls", async ({ page }) => {
  const error = '<img src="/fixture-injection" onerror="window.recoveryInjected=true">';
  const phase = '<svg onload="window.recoveryInjected=true">verify</svg>';
  const command = '<a href="javascript:window.recoveryInjected=true">npx ralph resume</a>';
  const scriptErrors: string[] = [];
  const dialogs: string[] = [];
  page.on("pageerror", error => scriptErrors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await logFixture(page, [entry("fixture-inert", stoppedEvent, { error, pendingPhase: phase, resume: command }, 0)]);
  await page.goto("/");
  await expectRecovery(page, error, phase, command);
  await expect(recovery(page).locator("img, svg, a, script, button, form")).toHaveCount(0);
  expect(await page.evaluate(() => "recoveryInjected" in window)).toBe(false);
  expect(scriptErrors).toEqual([]);
  expect(dialogs).toEqual([]);
});
