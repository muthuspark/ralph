import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assessBrowserReport, resolvePlaywrightCli } from "./ralph-browser.js";

const exec = promisify(execFile);

test("browser verification uses the target project's isolated Playwright installation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ralph-playwright-"));
  try {
    const require = createRequire(import.meta.url);
    // Real copies recreate a global Ralph install separate from the app's dependencies.
    for (const name of ["@playwright/test", "playwright", "playwright-core"]) {
      const destination = path.join(root, "node_modules", name);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.dirname(require.resolve(`${name}/package.json`)), destination, { recursive: true });
    }
    await writeFile(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    const spec = "e2e/ralph/isolated.spec.ts";
    await mkdir(path.dirname(path.join(root, spec)), { recursive: true });
    await writeFile(path.join(root, spec), `import { test, expect } from '@playwright/test';
test('project runner and spec share Playwright', () => { expect(2 + 2).toBe(4); });
`);
    const cli = resolvePlaywrightCli(root);
    assert.equal(cli, path.join(root, "node_modules/@playwright/test/cli.js"));
    const output = path.join(root, ".ralph/browser");
    await exec(process.execPath, [cli, "test", "--config",
      fileURLToPath(new URL("./playwright.ralph.config.ts", import.meta.url)), spec], {
      cwd: root, env: { ...process.env, RALPH_BROWSER_OUTPUT: output },
    });
    const report = JSON.parse(await readFile(path.join(output, "results.json"), "utf8"));
    assert.equal(assessBrowserReport(report).status, "passed");
    assert.equal(report.stats.expected, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing project Playwright reports installation instructions without using Ralph's copy", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ralph-no-playwright-"));
  try {
    assert.throws(() => resolvePlaywrightCli(root), /Install it in the target project .*npm install --save-dev @playwright\/test/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
