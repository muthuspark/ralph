import { z } from "zod";
import { createRequire } from "node:module";
import path from "node:path";

export function resolvePlaywrightCli(root: string): string {
  try {
    return createRequire(path.join(root, "package.json")).resolve("@playwright/test/cli");
  } catch (error) {
    throw new Error(`Browser verification blocked: cannot resolve @playwright/test from ${root}. Install it in the target project (npm install --save-dev @playwright/test), then resume; no repair attempt was consumed.`, { cause: error });
  }
}

const testSchema = z.object({
  status: z.enum(["expected", "unexpected", "flaky", "skipped"]),
  results: z.array(z.object({
    status: z.enum(["passed", "failed", "timedOut", "skipped", "interrupted"]),
  })),
});
type Suite = { specs: { tests: z.infer<typeof testSchema>[] }[]; suites?: Suite[] };
const suiteSchema: z.ZodType<Suite> = z.object({
  specs: z.array(z.object({ tests: z.array(testSchema) })),
  suites: z.lazy(() => z.array(suiteSchema)).optional(),
});
const reportSchema = z.object({
  suites: z.array(suiteSchema),
  errors: z.array(z.unknown()).optional(),
});

type BrowserAssessment = {
  status: "passed" | "failed" | "blocked";
  passed: number;
  reason: string;
};

export function assessBrowserReport(report: unknown, commandFailed = false): BrowserAssessment {
  // A missing or malformed report cannot substantiate browser verification.
  const parsed = reportSchema.parse(report);
  if (parsed.errors?.length) {
    return { status: "blocked", passed: 0, reason: "Playwright reported runner errors; inspect the report and runner log" };
  }
  const collect = (suites: Suite[]): z.infer<typeof testSchema>[] => suites.flatMap(suite => [
    ...suite.specs.flatMap(spec => spec.tests), ...collect(suite.suites ?? []),
  ]);
  const tests = collect(parsed.suites);
  if (!tests.length) return { status: "blocked", passed: 0, reason: "No browser tests were executed" };
  const passed = tests.filter(test => test.status === "expected" && test.results.length > 0 &&
    test.results.every(result => result.status === "passed")).length;
  if (commandFailed || passed !== tests.length) {
    return { status: "failed", passed, reason: `${passed}/${tests.length} browser tests passed without failures, skips, or retries${commandFailed ? "; runner exited unsuccessfully" : ""}` };
  }
  return { status: "passed", passed, reason: `All ${passed} browser tests passed` };
}
