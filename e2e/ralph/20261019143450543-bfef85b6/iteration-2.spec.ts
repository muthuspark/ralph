import { test, expect, type Page } from "@playwright/test";
import { progressPage } from "../../../ralph-server-page.js";

type Entry = { timestamp: string; run: string; event: string; details: unknown };
const runA = "fixture-follow-a";
const runB = "fixture-follow-b";
const runC = "fixture-follow-c";
const stopped = "Run stopped; changes preserved";

function entry(run: string, event: string, details: unknown, sequence: number): Entry {
  return { timestamp: new Date(Date.UTC(2026, 9, 19, 12, 0, sequence)).toISOString(), run, event, details };
}

function interleavedRuns(): Entry[] {
  return [
    entry(runA, "Run started", { goal: "Test-owned goal A", iterations: 4 }, 0),
    entry(runA, "Phase started", { phase: "implement", iteration: 1 }, 1),
    entry(runB, "Run started", { goal: "Test-owned goal B", iterations: 3 }, 2),
    entry(runB, "Phase started", { phase: "plan", iteration: 1 }, 3),
    entry(runB, stopped, { error: "Test-owned B failure", pendingPhase: "plan", resume: "npx ralph resume --run fixture-follow-b" }, 4),
    entry(runA, "Run resumed", { phase: "verify" }, 5),
    entry(runA, "Phase started", { phase: "verify", iteration: 2 }, 6),
  ];
}

// Match iteration-1's fixture: render the actual production viewer export even
// when the configured host serves another app. Only log payloads are substituted.
// This exercises client selection and polling, not the file reader or persistence.
// Routes are page-local and no real progress file, server, or run state is changed.
async function logFixture(page: Page, initial: Entry[]) {
  let entries = initial;
  await page.route(url => url.pathname === "/", route => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    headers: {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    },
    body: progressPage,
  }));
  await page.route("**/api/progress", route => {
    const text = entries.map(item => `\n[${item.timestamp}] ${item.run} — ${item.event}\n${JSON.stringify(item.details)}\n`).join("");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ file: "/test-owned/follow-progress.txt", exists: true, text, entries }),
    });
  });
  return (next: Entry[]) => { entries = next; };
}

function view(page: Page) {
  const main = page.getByRole("main");
  return {
    main,
    run: main.getByRole("combobox", { name: "Run", exact: true }),
    events: main.locator("#events .entry"),
    recovery: main.getByRole("region", { name: "Run stopped · changes preserved", exact: true }),
  };
}

async function expectSummary(page: Page, goal: string, phase: string, iteration: string, latest: string) {
  const { main } = view(page);
  await expect(main.locator("#goal")).toHaveText(goal);
  await expect(main.locator("#goal")).toBeVisible();
  await expect(main.locator("#phase")).toHaveText(phase);
  await expect(main.locator("#iteration")).toHaveText(iteration);
  await expect(main.locator("#latest")).toHaveText(latest);
}

async function expectEventTitles(page: Page, titles: string[]) {
  await expect(view(page).events.locator("summary .event-title")).toHaveText(titles);
}

test("initial selection and reload follow resumed A rather than later-created B", async ({ page }) => {
  await logFixture(page, interleavedRuns());
  await page.goto("/");
  for (let load = 0; load < 2; load++) {
    if (load) await page.reload();
    await expect(view(page).run).toHaveValue(runA);
    await expectSummary(page, "Test-owned goal A", "verify", "2 / 4", "Phase started");
    await expectEventTitles(page, ["Phase started", "Run resumed", "Phase started", "Run started"]);
    await expect(view(page).events.locator("summary .preview")).toHaveText([
      "verify", "verify", "implement", "Test-owned goal A",
    ]);
    await expect(view(page).recovery).toBeHidden();
    await expect(view(page).main.locator("#recovery-details")).toBeEmpty();
  }
});

test("automatic following moves to existing B and then newly appearing C on live updates", async ({ page }) => {
  let entries = interleavedRuns();
  const update = await logFixture(page, entries);
  await page.goto("/");
  await expect(view(page).run).toHaveValue(runA);
  entries = [...entries,
    entry(runB, "Run resumed", { phase: "review" }, 7),
    entry(runB, "Phase started", { phase: "review", iteration: 2 }, 8),
  ];
  update(entries);
  await expect(view(page).run).toHaveValue(runB);
  await expectSummary(page, "Test-owned goal B", "review", "2 / 3", "Phase started");
  await expectEventTitles(page, ["Phase started", "Run resumed", stopped, "Phase started", "Run started"]);
  await expect(view(page).recovery).toBeHidden();
  update([...entries,
    entry(runC, "Run started", { goal: "Test-owned goal C", iterations: 1 }, 9),
    entry(runC, "Phase started", { phase: "implement", iteration: 1 }, 10),
  ]);
  await expect(view(page).run).toHaveValue(runC);
  await expectSummary(page, "Test-owned goal C", "implement", "1 / 1", "Phase started");
  await expectEventTitles(page, ["Phase started", "Run started"]);
});

test("explicit selection stays pinned while another run resumes, including selecting the current run", async ({ page }) => {
  const entries = interleavedRuns();
  const update = await logFixture(page, entries);
  await page.goto("/");
  const { run, main, recovery } = view(page);
  await expect(run).toHaveValue(runA);
  // Selecting the current automatic choice must also disable following.
  await run.selectOption(runA);
  update([...entries, entry(runB, "Phase started", { phase: "review", iteration: 2 }, 7)]);
  // Raw log synchronization proves that a poll rendered the new payload before
  // checking stability; a stale page must not produce a false passing assertion.
  await expect(main.locator("#raw-text")).toContainText('"phase":"review"');
  await expect(run).toHaveValue(runA);
  await expectSummary(page, "Test-owned goal A", "verify", "2 / 4", "Phase started");
  await expectEventTitles(page, ["Phase started", "Run resumed", "Phase started", "Run started"]);
  await expect(recovery).toBeHidden();
  await run.selectOption(runB);
  await expectSummary(page, "Test-owned goal B", "review", "2 / 3", "Phase started");
  update([...entries,
    entry(runB, "Phase started", { phase: "review", iteration: 2 }, 7),
    entry(runA, stopped, { error: "Test-owned A failure", pendingPhase: "verify", resume: "npx ralph resume --run fixture-follow-a" }, 8),
  ]);
  await expect(main.locator("#raw-text")).toContainText("Test-owned A failure");
  await expect(run).toHaveValue(runB);
  await expectSummary(page, "Test-owned goal B", "review", "2 / 3", "Phase started");
  await expectEventTitles(page, ["Phase started", stopped, "Phase started", "Run started"]);
  await expect(recovery).toBeHidden();
  // Selection is intentionally page-local; a fresh load returns to following.
  await page.reload();
  await expect(view(page).run).toHaveValue(runA);
  await expectSummary(page, "Test-owned goal A", "Stopped · verify", "2 / 4", stopped);
  await expect(view(page).recovery.locator("dd")).toHaveText([
    "Test-owned A failure", "verify", "npx ralph resume --run fixture-follow-a",
  ]);
});

test("All runs remains selected while its summary and recovery follow only the last active run", async ({ page }) => {
  let entries = interleavedRuns();
  const update = await logFixture(page, entries);
  await page.goto("/");
  const { run, events, recovery } = view(page);
  await expect(run).toHaveValue(runA);
  await run.selectOption("");
  await expect(events).toHaveCount(7);
  await expectSummary(page, "Test-owned goal A", "verify", "2 / 4", "Phase started");
  await expect(recovery).toBeHidden();
  entries = [...entries, entry(runB, stopped, {
    error: "Test-owned B stopped again", pendingPhase: "plan", resume: "npx ralph resume --run fixture-follow-b",
  }, 7)];
  update(entries);
  await expect(events).toHaveCount(8);
  await expect(run).toHaveValue("");
  await expectSummary(page, "Test-owned goal B", "Stopped · plan", "1 / 3", stopped);
  await expect(recovery).toBeVisible();
  await expect(recovery.locator("dd")).toHaveText([
    "Test-owned B stopped again", "plan", "npx ralph resume --run fixture-follow-b",
  ]);
  update([...entries, entry(runA, stopped, {
    error: "Test-owned A stopped again", pendingPhase: "verify", resume: "npx ralph resume --run fixture-follow-a",
  }, 8)]);
  await expect(events).toHaveCount(9);
  await expect(run).toHaveValue("");
  await expectSummary(page, "Test-owned goal A", "Stopped · verify", "2 / 4", stopped);
  await expect(recovery.locator("dd")).toHaveText([
    "Test-owned A stopped again", "verify", "npx ralph resume --run fixture-follow-a",
  ]);
  await expect(recovery).not.toContainText("Test-owned B stopped again");
  await expect(recovery).not.toContainText("fixture-follow-b");
});
