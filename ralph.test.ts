import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOptions, rankCandidates } from "./ralph.js";
import { assessBrowserReport } from "./ralph-browser.js";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);

test("CLI accepts a goal and validates conflicting or unsafe options", () => {
  assert.equal(parseOptions(["--goal", "Improve onboarding"]).iterations, 10);
  assert.equal(parseOptions(["--resume", "run-1", "--retry-verification"]).retryVerification, true);
  for (const args of [[], ["--goal", "one", "--goal-file", "two"], ["--resume", "../run"],
    ["--goal", "one", "--iterations", "-1"], ["--goal", "one", "--goal", "two"]]) {
    assert.throws(() => parseOptions(args));
  }
});

test("candidate necessity outranks an easier but less important increment", () => {
  const base = { title: "Easy", category: "UX", rationale: "Reason", evidence: ["source"],
    acceptanceCriteria: ["works"], impact: 5, confidence: 5, effort: 1, risk: 1 };
  const assessment = (score: number) => ({ productManager: { score, rationale: "Reason" },
    subjectMatterExpert: { score, rationale: "Reason", domain: "UX" } });
  assert.equal(rankCandidates([
    { ...base, mustDo: assessment(2) },
    { ...base, title: "Essential", effort: 5, mustDo: assessment(5) },
  ])[0].title, "Essential");
});

const report = (status = "expected", results = ["passed"]) => ({
  suites: [{ specs: [], suites: [{ specs: [{ tests: [{ status, results: results.map(status => ({ status })) }] }] }] }],
  errors: [],
});

test("browser verification accepts actual passing tests in nested suites", () => {
  assert.deepEqual(assessBrowserReport(report()), { status: "passed", passed: 1, reason: "All 1 browser tests passed" });
});

test("browser verification rejects failed, skipped, flaky, and expected-failure tests", () => {
  for (const [status, results] of [
    ["unexpected", ["failed"]], ["skipped", ["skipped"]],
    ["flaky", ["failed", "passed"]], ["expected", ["failed"]], ["expected", []],
  ] as [string, string[]][]) {
    assert.equal(assessBrowserReport(report(status, results)).status, "failed");
  }
  assert.equal(assessBrowserReport(report(), true).status, "failed");
});

test("browser verification blocks empty or runner-error reports and rejects malformed reports", () => {
  assert.equal(assessBrowserReport({ suites: [] }).status, "blocked");
  assert.equal(assessBrowserReport({ ...report(), errors: [{ message: "Setup failed" }] }).status, "blocked");
  assert.throws(() => assessBrowserReport({}));
});

test("CLI records failed checks and resumes in the target repository without losing progress", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ralph-test-"));
  try {
    const bin = path.join(root, "bin");
    await mkdir(bin);
    await writeFile(path.join(bin, "codex"), '#!/usr/bin/env node\nprocess.exit(process.argv[2] === "--version" ? 0 : 99);\n', { mode: 0o755 });
    await writeFile(path.join(root, ".gitignore"), ".ralph/\n");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: {
      lint: 'node -e "process.exit(1)"', typecheck: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"', build: 'node -e "process.exit(0)"',
    } }));
    await exec("git", ["init", "-b", "main"], { cwd: root });
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["-c", "user.name=Ralph Test", "-c", "user.email=ralph@example.test",
      "-c", "commit.gpgsign=false", "commit", "-m", "Test fixture"], { cwd: root });
    const tsx = createRequire(import.meta.url).resolve("tsx/cli");
    const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
    const run = (args: string[]) => exec(process.execPath, [tsx, cli, ...args], {
      cwd: root, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    });
    await assert.rejects(run(["--goal", "Improve test project", "--iterations", "1"]), /Baseline checks failed/);
    const progress = await readFile(path.join(root, "progress.txt"), "utf8");
    for (const event of ["Run started", "Phase started", "Check failed", "Check passed", "Run stopped; changes preserved"]) {
      assert.ok(progress.includes(event), `Missing event: ${event}`);
    }
    const [id] = await readdir(path.join(root, ".ralph"));
    const state = JSON.parse(await readFile(path.join(root, ".ralph", id, "state.json"), "utf8"));
    assert.equal(state.root, root);
    assert.equal(state.phase, "baseline");
    await assert.rejects(run(["--resume", id]), /Baseline checks failed/);
    const resumed = await readFile(path.join(root, "progress.txt"), "utf8");
    assert.ok(resumed.startsWith(progress));
    assert.ok(resumed.includes("Run resumed"));
    assert.deepEqual(await readdir(path.join(root, ".ralph")), [id]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
