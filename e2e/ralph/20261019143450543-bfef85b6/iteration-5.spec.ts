import { test, expect, type Page } from "@playwright/test";
import { progressPage } from "../../../ralph-server-page.js";

type Entry = { timestamp: string; run: string; event: string; details: unknown };
const runA = "fixture-selection-a";
const runB = "fixture-selection-b";

function entry(run: string, event: string, details: unknown, sequence: number): Entry {
  return { timestamp: new Date(Date.UTC(2026, 9, 19, 12, 0, sequence)).toISOString(), run, event, details };
}

function selection(run: string, title: string, iteration: number, sequence: number): Entry {
  return entry(run, "Candidate selected", {
    iteration,
    candidate: { title, rationale: `Reason for ${title}`, acceptanceCriteria: [`Verify ${title}`, "Keep existing work safe"] },
  }, sequence);
}

// Established fixture pattern: exercise the production HTML and its polling at
// the configured baseURL with page-local, test-owned log responses. This does not
// test the file parser or disk persistence and never writes real progress data.
async function logFixture(page: Page, initial: Entry[]) {
  let entries = initial;
  await page.route(url => url.pathname === "/", route => route.fulfill({
    status: 200, contentType: "text/html; charset=utf-8",
    headers: { "cache-control": "no-store" }, body: progressPage,
  }));
  await page.route("**/api/progress", route => route.fulfill({
    status: 200, contentType: "application/json", headers: { "cache-control": "no-store" },
    body: JSON.stringify({
      file: "/test-owned/selection-progress.txt", exists: true, entries,
      text: entries.map(item => `\n[${item.timestamp}] ${item.run} — ${item.event}\n${JSON.stringify(item.details)}\n`).join(""),
    }),
  }));
  return (next: Entry[]) => { entries = next; };
}

function view(page: Page) {
  const main = page.getByRole("main");
  const selected = main.getByRole("region", { name: "Selected increment", exact: true });
  return {
    main, selected,
    title: selected.locator("#selection-title"),
    context: selected.locator("#selection-context"),
    disclosure: selected.locator("#selection-disclosure"),
    toggle: selected.locator("summary").filter({ hasText: "Rationale and acceptance criteria" }),
    fields: selected.locator("#selection-details"),
    run: main.getByRole("combobox", { name: "Run", exact: true }),
    search: main.getByRole("searchbox", { name: "Search events", exact: true }),
    rows: main.locator("#events .entry"),
    count: main.locator("#count"),
  };
}

test("selection stays above Activity outside the first 100 events, search, and pagination", async ({ page }) => {
  const entries = [
    selection(runA, "Earlier increment", 1, 0),
    selection(runA, "Current increment", 2, 1),
    ...Array.from({ length: 105 }, (_, index) => entry(runA, "Check started", { note: `Routine check ${index}` }, index + 2)),
  ];
  await logFixture(page, entries);
  await page.goto("/");
  const v = view(page);
  await expect(v.run).toHaveValue(runA);
  await expect(v.title).toHaveText("Current increment");
  await expect(v.context).toHaveText(`Run: ${runA} · Iteration: 2`);
  await expect(v.count).toHaveText("100 of 107 events");
  await expect(v.rows.locator(".event-title").filter({ hasText: "Candidate selected" })).toHaveCount(0);
  expect(await v.selected.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector(".activity-heading")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(v.fields).toBeHidden();
  await v.search.fill("no-event-has-this-fixture-token");
  await expect(v.count).toHaveText("0 events");
  await expect(v.title).toBeVisible();
  await expect(v.title).toHaveText("Current increment");
  await v.search.fill("");
  await v.main.getByRole("button", { name: "Show more events", exact: true }).click();
  await expect(v.count).toHaveText("107 of 107 events");
  await expect(v.title).toHaveText("Current increment");
  await page.reload();
  await expect(v.count).toHaveText("100 of 107 events");
  await expect(v.title).toHaveText("Current increment");
  await expect(v.context).toHaveText(`Run: ${runA} · Iteration: 2`);
});

test("keyboard disclosure renders structured rationale and criteria as readable content", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await logFixture(page, [entry(runA, "Candidate selected", {
    iteration: 3,
    candidate: {
      title: "Explain the chosen work",
      rationale: { reason: "Operators need context", evidence: ["Recorded fixture evidence"] },
      acceptanceCriteria: ["Show intent before Activity", { outcome: "Readable structured criteria", checks: ["Keyboard access"] }],
    },
  }, 0)]);
  await page.goto("/");
  const v = view(page);
  await expect(v.title).toHaveText("Explain the chosen work");
  await expect(v.fields).toBeHidden();
  await v.toggle.focus();
  await page.keyboard.press("Enter");
  await expect(v.fields).toBeVisible();
  for (const text of ["Operators need context", "Recorded fixture evidence", "Show intent before Activity", "Readable structured criteria", "Keyboard access"]) {
    await expect(v.fields.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(v.selected).not.toContainText("[object Object]");
  await expect(v.selected).not.toContainText("undefined");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(v.toggle).toBeFocused();
  await page.keyboard.press("Space");
  await expect(v.fields).toBeHidden();
});

test("run switching exposes unavailable and missing-field states without stale details", async ({ page }) => {
  const runC = "fixture-selection-missing";
  await logFixture(page, [
    entry(runB, "Run started", { goal: "No selection in this run" }, 0),
    entry(runC, "Candidate selected", { candidate: {} }, 1),
    selection(runA, "Complete selection", 4, 2),
  ]);
  await page.goto("/");
  const v = view(page);
  await expect(v.title).toHaveText("Complete selection");
  await v.toggle.click();
  await expect(v.fields).toContainText("Reason for Complete selection");
  await v.run.selectOption(runB);
  await expect(v.context).toHaveText(`Run: ${runB}`);
  await expect(v.title).toHaveText("No candidate selection recorded for this run.");
  await expect(v.disclosure).toBeHidden();
  await expect(v.fields).toBeEmpty();
  await v.run.selectOption(runC);
  await expect(v.title).toHaveText("Candidate title not recorded.");
  await expect(v.context).toHaveText(`Run: ${runC} · Iteration not recorded`);
  await v.toggle.click();
  await expect(v.fields.getByText("No rationale recorded.", { exact: true })).toBeVisible();
  await expect(v.fields.getByText("No acceptance criteria recorded.", { exact: true })).toBeVisible();
  await expect(v.selected).not.toContainText("[object Object]");
  await v.run.selectOption(runA);
  await expect(v.title).toHaveText("Complete selection");
  await expect(v.context).toHaveText(`Run: ${runA} · Iteration: 4`);
  await expect(v.fields).toBeHidden();
  await v.toggle.click();
  await expect(v.fields.getByText("Verify Complete selection", { exact: true })).toBeVisible();
});

test("live replacement follows append order while unrelated runs preserve the selected disclosure", async ({ page }) => {
  const entries = [selection(runA, "Original increment", 1, 0)];
  const update = await logFixture(page, entries);
  await page.goto("/");
  const v = view(page);
  await expect(v.run).toHaveValue(runA);
  // Explicit selection pins this run even when another run appends activity.
  await v.run.selectOption(runA);
  await v.toggle.focus();
  await page.keyboard.press("Enter");
  await expect(v.fields.getByText("Verify Original increment", { exact: true })).toBeVisible();
  const unrelated = selection(runB, "Other run increment", 9, 1);
  // A same-run check provides a visible marker that this refresh was consumed.
  const check = entry(runA, "Check started", { note: "Refresh marker" }, 2);
  update([...entries, unrelated, check]);
  await expect(v.count).toHaveText("2 of 2 events");
  await expect(v.run).toHaveValue(runA);
  await expect(v.title).toHaveText("Original increment");
  await expect(v.fields.getByText("Verify Original increment", { exact: true })).toBeVisible();
  await expect(v.toggle).toBeFocused();
  // Older timestamp, later log append: the latest recorded selection must win.
  const replacement = selection(runA, "Replacement increment", 2, -1);
  update([...entries, unrelated, check, replacement]);
  await expect(v.title).toHaveText("Replacement increment");
  await expect(v.context).toHaveText(`Run: ${runA} · Iteration: 2`);
  await expect(v.fields).toBeHidden();
  await v.toggle.click();
  await expect(v.fields.getByText("Reason for Replacement increment", { exact: true })).toBeVisible();
  await expect(v.fields.getByText("Verify Replacement increment", { exact: true })).toBeVisible();
  await expect(v.selected).not.toContainText("Original increment");
  await page.reload();
  await expect(v.run).toHaveValue(runA);
  await expect(v.title).toHaveText("Replacement increment");
  await v.toggle.click();
  await expect(v.fields.getByText("Verify Replacement increment", { exact: true })).toBeVisible();
  await v.run.selectOption(runB);
  await expect(v.title).toHaveText("Other run increment");
});
