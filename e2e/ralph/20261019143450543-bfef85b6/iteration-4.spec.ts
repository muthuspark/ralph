import { test, expect, type Page } from "@playwright/test";
import { progressPage } from "../../../ralph-server-page.js";

type Entry = { timestamp: string; run: string; event: string; details: unknown };
const runA = "fixture-context-a";
const runB = "fixture-context-b";
const command = "npm run fixture-check";

function entry(run: string, event: string, details: unknown, sequence: number): Entry {
  return { timestamp: new Date(Date.UTC(2026, 9, 19, 12, 0, sequence)).toISOString(), run, event, details };
}

// Use the established browser fixtures: serve the production viewer export and
// page-local log responses at the configured baseURL. This tests client rendering
// and polling, not the file parser, grading, or persistence. No jobs or writes to
// real progress files occur; Playwright removes the routes with the page context.
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
  await page.route("**/api/progress", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify({
      file: "/test-owned/context-progress.txt", exists: true, entries,
      text: entries.map(item => `\n[${item.timestamp}] ${item.run} — ${item.event}\n${JSON.stringify(item.details)}\n`).join(""),
    }),
  }));
  return (next: Entry[]) => { entries = next; };
}

function view(page: Page) {
  const main = page.getByRole("main");
  return {
    run: main.getByRole("combobox", { name: "Run", exact: true }),
    search: main.getByRole("searchbox", { name: "Search events", exact: true }),
    rows: main.locator("#events .entry"),
  };
}

async function expectContext(page: Page, item: Entry, labels: string[]) {
  const row = view(page).rows.filter({ has: page.locator(`time[datetime="${item.timestamp}"]`) });
  await expect(row).toHaveCount(1);
  await expect(row).not.toHaveAttribute("open");
  await expect(row.locator(".event-body")).toBeHidden();
  const summary = row.locator("summary");
  await expect(summary.locator(".event-title")).toHaveText(item.event);
  const context = summary.locator(".event-context span");
  await expect(context).toHaveText(labels);
  for (let index = 0; index < labels.length; index++) await expect(context.nth(index)).toBeVisible();
}

function interleavedRuns() {
  return [
    entry(runA, "Run started", { goal: "Context fixture A", iterations: 4 }, 0),
    entry(runA, "Check started", { command }, 1),
    entry(runA, "Phase started", { phase: "implement", iteration: 1 }, 2),
    entry(runB, "Phase started", { phase: "review", iteration: 3 }, 3),
    entry(runA, "Check started", { command }, 4),
    entry(runB, "Check started", { command }, 5),
    entry(runA, "Phase started", { phase: "verify", iteration: 2 }, 6),
    entry(runA, "Check started", { command }, 7),
  ];
}

test("collapsed repeated commands show their own run and historical attempt before and after reload", async ({ page }) => {
  const entries = interleavedRuns();
  await logFixture(page, entries);
  await page.goto("/");
  for (let load = 0; load < 2; load++) {
    if (load) await page.reload();
    await expect(view(page).run).toHaveValue(runA);
    await view(page).run.selectOption("");
    await expect(view(page).rows).toHaveCount(entries.length);
    await expect(view(page).rows.locator("summary .event-title")).toHaveText(entries.toReversed().map(item => item.event));
    // Exact chronological identities also distinguish identical command rows.
    expect(await view(page).rows.locator("summary time").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime"))))
      .toEqual(entries.toReversed().map(item => item.timestamp));
    await expectContext(page, entries[0], [`Run: ${runA}`]);
    await expectContext(page, entries[1], [`Run: ${runA}`]);
    await expectContext(page, entries[2], [`Run: ${runA}`, "Iteration: 1", "Phase: implement"]);
    await expectContext(page, entries[3], [`Run: ${runB}`, "Iteration: 3", "Phase: review"]);
    await expectContext(page, entries[4], [`Run: ${runA}`, "Iteration: 1", "Phase: implement"]);
    await expectContext(page, entries[5], [`Run: ${runB}`, "Iteration: 3", "Phase: review"]);
    await expectContext(page, entries[6], [`Run: ${runA}`, "Iteration: 2", "Phase: verify"]);
    await expectContext(page, entries[7], [`Run: ${runA}`, "Iteration: 2", "Phase: verify"]);
  }
});

test("search and run filtering retain context from phase rows outside the visible results", async ({ page }) => {
  const entries = interleavedRuns();
  await logFixture(page, entries);
  await page.goto("/");
  const { run, search, rows } = view(page);
  await expect(run).toHaveValue(runA);
  await run.selectOption("");
  await search.fill(command);
  await expect(rows).toHaveCount(4);
  await expect(rows.locator("summary .preview")).toHaveText([command, command, command, command]);
  await expectContext(page, entries[1], [`Run: ${runA}`]);
  await expectContext(page, entries[4], [`Run: ${runA}`, "Iteration: 1", "Phase: implement"]);
  await expectContext(page, entries[5], [`Run: ${runB}`, "Iteration: 3", "Phase: review"]);
  await expectContext(page, entries[7], [`Run: ${runA}`, "Iteration: 2", "Phase: verify"]);
  await run.selectOption(runA);
  await expect(rows).toHaveCount(3);
  await expectContext(page, entries[1], []);
  await expectContext(page, entries[4], ["Iteration: 1", "Phase: implement"]);
  await expectContext(page, entries[7], ["Iteration: 2", "Phase: verify"]);
  await run.selectOption(runB);
  await expect(rows).toHaveCount(1);
  await expectContext(page, entries[5], ["Iteration: 3", "Phase: review"]);
  await search.fill("");
  await expect(rows).toHaveCount(2);
  await expectContext(page, entries[3], ["Iteration: 3", "Phase: review"]);
});

test("missing fields and run boundaries never borrow context from other runs or later rows", async ({ page }) => {
  const entries = [
    entry(runA, "Phase started", { iteration: 1, phase: "implement" }, 0),
    entry(runB, "Check started", null, 1),
    entry(runA, "Check started", { iteration: 2, command }, 2),
    entry(runA, "Check started", { iteration: 3, phase: "review", command }, 3),
    entry(runA, "Check started", { command }, 4),
    entry(runA, "Run resumed", {}, 5),
    entry(runA, "Check started", { command }, 6),
    entry(runA, "Phase started", { iteration: 4 }, 7),
    entry(runA, "Check started", { command }, 8),
    entry(runA, "Phase started", { phase: "verify" }, 9),
    entry(runA, "Check started", { command }, 10),
    entry(runA, "Run started", {}, 11),
    entry(runA, "Check started", { command }, 12),
  ];
  await logFixture(page, entries);
  await page.goto("/");
  await expect(view(page).run).toHaveValue(runA);
  await view(page).run.selectOption("");
  await expect(view(page).rows).toHaveCount(entries.length);
  await expectContext(page, entries[1], [`Run: ${runB}`]);
  await expectContext(page, entries[2], [`Run: ${runA}`, "Iteration: 2"]);
  await expectContext(page, entries[3], [`Run: ${runA}`, "Iteration: 3", "Phase: review"]);
  // A normal check's recorded fields apply only to that check.
  await expectContext(page, entries[4], [`Run: ${runA}`, "Iteration: 1", "Phase: implement"]);
  for (const index of [5, 6, 11, 12]) await expectContext(page, entries[index], [`Run: ${runA}`]);
  for (const index of [7, 8]) await expectContext(page, entries[index], [`Run: ${runA}`, "Iteration: 4"]);
  for (const index of [9, 10]) await expectContext(page, entries[index], [`Run: ${runA}`, "Phase: verify"]);
});

test("live append uses per-run append order and preserves historical context on mobile and reload", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const entries = interleavedRuns();
  const update = await logFixture(page, entries);
  await page.goto("/");
  await expect(view(page).run).toHaveValue(runA);
  await view(page).run.selectOption("");
  await expect(view(page).rows).toHaveCount(entries.length);
  // Deliberately older timestamps: attribution must follow log append order.
  const boundary = entry(runB, "Phase started", { iteration: 4, phase: "repair" }, -2);
  const bCheck = entry(runB, "Check started", { command }, -1);
  const aCheck = entry(runA, "Check started", { command }, 10);
  update([...entries, boundary, bCheck, aCheck]);
  await expect(view(page).rows).toHaveCount(entries.length + 3);
  await expect(view(page).run).toHaveValue("");
  for (let load = 0; load < 2; load++) {
    if (load) {
      await page.reload();
      await expect(view(page).run).toHaveValue(runA);
      await view(page).run.selectOption("");
    }
    await expectContext(page, bCheck, [`Run: ${runB}`, "Iteration: 4", "Phase: repair"]);
    await expectContext(page, aCheck, [`Run: ${runA}`, "Iteration: 2", "Phase: verify"]);
    await expectContext(page, entries[5], [`Run: ${runB}`, "Iteration: 3", "Phase: review"]);
    await expectContext(page, entries[1], [`Run: ${runA}`]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
