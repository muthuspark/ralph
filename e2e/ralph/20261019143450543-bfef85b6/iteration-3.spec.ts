import { test, expect, type Page, type Locator } from "@playwright/test";
import { progressPage } from "../../../ralph-server-page.js";

type Entry = { timestamp: string; run: string; event: string; details: unknown };
const browserEvent = "Host Playwright verification";

function entry(event: string, details: unknown, sequence = 0): Entry {
  return {
    timestamp: new Date(Date.UTC(2026, 9, 19, 12, 0, sequence)).toISOString(),
    run: "fixture-outcomes", event, details,
  };
}

// Reuse the previous increments' fixture pattern: the actual production viewer
// consumes page-local log fixtures. This covers rendering, polling, and reload,
// not grading, file persistence, or the server's progress parser. No jobs execute
// and no user files, server environment, or real run state are changed.
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
      file: "/test-owned/outcome-progress.txt", exists: true, entries,
      text: entries.map(item => `\n[${item.timestamp}] ${item.run} — ${item.event}\n${JSON.stringify(item.details)}\n`).join(""),
    }),
  }));
  return (next: Entry[]) => { entries = next; };
}

function row(page: Page, event: string): Locator {
  return page.getByRole("main").locator("#events .entry").filter({
    has: page.getByText(event, { exact: true }),
  });
}

async function expectCollapsedOutcome(target: Locator, label: string, context?: string) {
  await expect(target).toHaveCount(1);
  await expect(target).not.toHaveAttribute("open");
  await expect(target.locator(".event-body")).toBeHidden();
  const summary = target.locator("summary");
  await expect(summary.locator(".outcome")).toHaveText(label);
  await expect(summary.locator(".outcome")).toBeVisible();
  if (context) {
    await expect(summary.locator(".outcome-context")).toHaveText(context);
    await expect(summary.locator(".outcome-context")).toBeVisible();
  } else {
    await expect(summary.locator(".outcome-context")).toHaveCount(0);
  }
}

for (const fixture of [
  { status: "failed", label: "Failed · Repair required", reason: "2 acceptance tests failed: collapsed reason was missing." },
  { status: "blocked", label: "Blocked", reason: "No tests executed: browser executable unavailable." },
  { status: "passed", label: "Passed", reason: "All 4 executed browser checks passed." },
]) {
  test(`${fixture.status} browser check exposes its recorded outcome and reason while collapsed, including reload`, async ({ page }) => {
    await logFixture(page, [
      entry("Phase started", { phase: "review", iteration: 1 }),
      entry(browserEvent, { status: fixture.status, reason: fixture.reason }, 1),
    ]);
    await page.goto("/");
    for (let load = 0; load < 2; load++) {
      if (load) await page.reload();
      await expectCollapsedOutcome(row(page, browserEvent), fixture.label, fixture.reason);
      // A passed browser check is local to that row; review is still pending.
      await expect(page.getByRole("main").locator("#phase")).toHaveText("review");
      await expect(page.getByRole("main").locator("#events .outcome")).toHaveText([fixture.label]);
      await expect(page.getByRole("main")).not.toContainText(/iteration verified|all gates passed/i);
    }
  });
}

test("verification and independent review repair decisions expose every recorded failure and finding", async ({ page }) => {
  const failures = ["Typecheck failed: incompatible return type.", "Build failed: missing viewer export."];
  const unresolved = ["Collapsed status does not identify the blocked check."];
  const findings = ["Mobile outcome context is clipped."];
  await logFixture(page, [
    entry("Verification decision", { nextPhase: "repair", failures }),
    entry("Independent review decision", { nextPhase: "repair", unresolved, findings }, 1),
  ]);
  await page.goto("/");
  await expectCollapsedOutcome(row(page, "Verification decision"), "Repair required", failures.join("\n"));
  await expectCollapsedOutcome(row(page, "Independent review decision"), "Repair required", [...unresolved, ...findings].join("\n"));
  // Disclosure still exposes the original record and can be closed again.
  const review = row(page, "Independent review decision");
  await review.locator("summary").click();
  await expect(review.locator(".event-body")).toBeVisible();
  await expect(review.locator(".event-body")).toContainText(findings[0]);
  await review.locator("summary").click();
  await expectCollapsedOutcome(review, "Repair required", [...unresolved, ...findings].join("\n"));
});

test("continuing decisions do not claim the iteration is verified", async ({ page }) => {
  await logFixture(page, [
    entry("Verification decision", { nextPhase: "review", failures: [] }),
    entry("Independent review decision", { nextPhase: "commit", unresolved: [], findings: [] }, 1),
  ]);
  await page.goto("/");
  for (const event of ["Verification decision", "Independent review decision"]) {
    await expectCollapsedOutcome(row(page, event), "Repair not requested");
    await expect(row(page, event).locator("summary")).not.toContainText("Passed");
  }
  await expect(page.getByRole("main")).not.toContainText(/iteration verified|all gates passed/i);
});

for (const [name, details] of [
  ["missing", {}],
  ["unknown", { status: "pending", reason: "Waiting for a recorded result." }],
  ["malformed", { status: { passed: true }, reason: { text: "Not a recorded string" } }],
  ["null", null],
] as const) {
  test(`${name} fields stay neutral rather than inventing success or repair`, async ({ page }) => {
    await logFixture(page, [
      entry(browserEvent, details),
      entry("Verification decision", { failures: null }, 1),
      entry("Independent review decision", { nextPhase: "unknown", unresolved: [null, 7], findings: {} }, 2),
    ]);
    await page.goto("/");
    await expectCollapsedOutcome(row(page, browserEvent), "Outcome not recorded",
      name === "unknown" ? "Waiting for a recorded result." : undefined);
    for (const event of ["Verification decision", "Independent review decision"]) {
      await expectCollapsedOutcome(row(page, event), "Outcome not recorded");
    }
    const summaries = page.getByRole("main").locator("#events summary");
    await expect(summaries).toHaveCount(3);
    await expect(page.getByRole("main").locator("#events .entry.good, #events .entry.bad")).toHaveCount(0);
    await expect(page.getByRole("main").locator("#events")).not.toContainText("[object Object]");
  });
}

test("live results retain historical failures and display the new passed check after reload on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const failure = entry(browserEvent, { status: "failed", reason: "Expected a visible verification reason." });
  const update = await logFixture(page, [failure]);
  await page.goto("/");
  await expectCollapsedOutcome(row(page, browserEvent), "Failed · Repair required", "Expected a visible verification reason.");
  update([failure, entry(browserEvent, { status: "passed", reason: "The repaired acceptance check passed." }, 1)]);
  for (let load = 0; load < 2; load++) {
    if (load) await page.reload();
    const rows = row(page, browserEvent);
    await expect(rows).toHaveCount(2);
    await expectCollapsedOutcome(rows.nth(0), "Passed", "The repaired acceptance check passed.");
    await expectCollapsedOutcome(rows.nth(1), "Failed · Repair required", "Expected a visible verification reason.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("recorded reasons and findings remain inert visible text", async ({ page }) => {
  const reason = '<img src="/fixture-outcome-injection" onerror="window.outcomeInjected=true">';
  const finding = '<svg onload="window.outcomeInjected=true">Missing outcome</svg>';
  await logFixture(page, [
    entry(browserEvent, { status: "blocked", reason }),
    entry("Independent review decision", { nextPhase: "repair", unresolved: [finding] }, 1),
  ]);
  await page.goto("/");
  await expectCollapsedOutcome(row(page, browserEvent), "Blocked", reason);
  await expectCollapsedOutcome(row(page, "Independent review decision"), "Repair required", finding);
  await expect(page.getByRole("main").locator("#events summary img, #events summary svg, #events summary script")).toHaveCount(0);
  expect(await page.evaluate(() => "outcomeInjected" in window)).toBe(false);
});
