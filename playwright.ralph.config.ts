import type { PlaywrightTestConfig } from "@playwright/test";
import path from "node:path";

const output = process.env.RALPH_BROWSER_OUTPUT ?? path.resolve(".ralph", "browser");

// Keep this config free of runtime Playwright imports: the target project owns the runner.
export default {
  testDir: path.resolve("e2e/ralph"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: path.join(output, "artifacts"),
  reporter: [["list"], ["json", { outputFile: path.join(output, "results.json") }]],
  use: {
    baseURL: process.env.RALPH_BASE_URL ?? "http://localhost:3000",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
} satisfies PlaywrightTestConfig;
