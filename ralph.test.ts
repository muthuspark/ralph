import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOptions, rankCandidates } from "./ralph.js";
import { assessBrowserReport } from "./ralph-browser.js";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolveVerification } from "./ralph-project.js";

const exec = promisify(execFile);

test("CLI accepts a goal and validates conflicting or unsafe options", () => {
  assert.equal(parseOptions(["--goal", "Improve onboarding"]).iterations, 10);
  assert.equal(parseOptions(["--goal", "Improve onboarding", "--agent", "claude"]).agent, "claude");
  assert.equal(parseOptions(["--resume", "run-1", "--retry-verification"]).retryVerification, true);
  assert.equal(parseOptions(["--resume", "run-1", "--agent", "claude"]).agent, "claude");
  for (const args of [[], ["--goal", "one", "--goal-file", "two"], ["--resume", "../run"],
    ["--goal", "one", "--iterations", "-1"], ["--goal", "one", "--goal", "two"],
    ["--goal", "one", "--agent", "unknown"]]) {
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
    for (const agent of ["codex", "claude"]) {
      await writeFile(path.join(bin, agent), '#!/usr/bin/env node\nprocess.exit(process.argv[2] === "--version" ? 0 : 99);\n', { mode: 0o755 });
    }
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
    await assert.rejects(run(["--goal", "Improve test project", "--agent", "claude", "--iterations", "1"]), /Baseline checks failed/);
    const progress = await readFile(path.join(root, "progress.txt"), "utf8");
    for (const event of ["Run started", "Phase started", "Check failed", "Check passed", "Run stopped; changes preserved"]) {
      assert.ok(progress.includes(event), `Missing event: ${event}`);
    }
    const [id] = await readdir(path.join(root, ".ralph"));
    const state = JSON.parse(await readFile(path.join(root, ".ralph", id, "state.json"), "utf8"));
    assert.equal(state.root, await realpath(root));
    assert.equal(state.agent, "claude");
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

test("Python verification detects sources, requires new tests, and supports explicit commands", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ralph-python-"));
  try {
    await exec("git", ["init"], { cwd: root });
    await writeFile(path.join(root, "pyproject.toml"), '[project]\nname = "fixture"\n');
    await writeFile(path.join(root, "app.py"), "answer = 42\n");
    const baseline = await resolveVerification(root);
    assert.equal(baseline.browser, false);
    assert.deepEqual(baseline.checks[0].command, ["python3", "-m", "py_compile", "app.py"]);
    assert.match(baseline.notes[0], /No Python tests/);
    await assert.rejects(resolveVerification(root, true), /requires tests/);
    await mkdir(path.join(root, "tests"));
    await writeFile(path.join(root, "tests", "test_app.py"), "import unittest\n");
    assert.equal((await resolveVerification(root, true)).checks[1].name, "test-1");
    await writeFile(path.join(root, "uv.lock"), "");
    assert.deepEqual((await resolveVerification(root)).checks[0].command.slice(0, 4), ["uv", "run", "--locked", "python"]);
    await writeFile(path.join(root, "ralph.config.json"), JSON.stringify({ checks: [{ name: "custom", command: ["python3", "-m", "unittest"] }], browser: false }));
    assert.equal((await resolveVerification(root)).checks[0].name, "custom");
    await writeFile(path.join(root, "ralph.config.json"), '{"checks": [], "browser": false}');
    await assert.rejects(resolveVerification(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Python CLI completes a verified iteration without npm scripts or a browser", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ralph-python-loop-"));
  try {
    await mkdir(path.join(root, "bin"));
    await writeFile(path.join(root, ".gitignore"), ".ralph/\n");
    await writeFile(path.join(root, "pyproject.toml"), '[project]\nname = "fixture"\n');
    await writeFile(path.join(root, "app.py"), "answer = 1\n");
    const mock = `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv[2] === '--version') process.exit(0);
let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);
process.stdin.on('end', () => {
  let result;
  if (prompt.includes('PHASE: discover')) {
    result = { candidates: Array.from({length: 5}, (_, i) => ({
      title: 'Fix answer ' + i, category: 'correctness', rationale: 'Fixture', evidence: ['app.py'],
      acceptanceCriteria: ['answer is 42'], impact: 5, confidence: 5, effort: 1, risk: 1,
      mustDo: { productManager: {score: 5, rationale: 'Fixture'}, subjectMatterExpert: {score: 5, rationale: 'Fixture', domain: 'arithmetic'} }
    })) };
  } else if (prompt.includes('PHASE: implement')) {
    fs.writeFileSync('app.py', 'answer = 42\\n');
    fs.mkdirSync('tests');
    fs.writeFileSync('tests/test_app.py', 'import unittest\\nfrom app import answer\\nclass AnswerTest(unittest.TestCase):\\n    def test_answer(self):\\n        self.assertEqual(answer, 42)\\n');
    result = { summary: 'Fixed answer with a unit test', decisions: [{decision: 'Use 42', reason: 'Acceptance criterion'}] };
  } else if (prompt.includes('PHASE: review')) {
    result = { summary: 'Fixture review', acceptancePassed: true, acceptanceEvidence: ['tests/test_app.py'], userFacing: true, browserEvidence: [], findings: [] };
  } else { process.exit(98); }
  fs.writeFileSync(process.argv[process.argv.indexOf('--output-last-message') + 1], JSON.stringify(result));
});
`;
    await writeFile(path.join(root, "bin", "codex"), mock, { mode: 0o755 });
    await exec("git", ["init", "-b", "main"], { cwd: root });
    for (const [key, value] of [["user.name", "Ralph Test"], ["user.email", "ralph@example.test"], ["commit.gpgsign", "false"]]) {
      await exec("git", ["config", key, value], { cwd: root });
    }
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "Fixture"], { cwd: root });
    const { stdout } = await exec(process.execPath, [createRequire(import.meta.url).resolve("tsx/cli"),
      fileURLToPath(new URL("./cli.ts", import.meta.url)), "--goal", "Fix answer", "--iterations", "1"], {
      cwd: root, env: { ...process.env, PATH: `${path.join(root, "bin")}${path.delimiter}${process.env.PATH}` },
    });
    assert.match(stdout, /Finished 1 verified iterations/);
    assert.match(stdout, /browser disabled/);
    const progress = await readFile(path.join(root, "progress.txt"), "utf8");
    assert.ok(progress.includes("No Python tests exist yet"));
    assert.ok(progress.includes("unittest"));
    assert.ok(!progress.includes('"phase": "browser-run"'));
    assert.equal((await exec("git", ["status", "--porcelain"], { cwd: root })).stdout, "");
    const log = (await exec("git", ["show", "--format=", "--name-only", "HEAD"], { cwd: root })).stdout;
    assert.ok(log.includes("progress.txt"));
    assert.ok(log.includes("tests/test_app.py"));
  } finally { await rm(root, { recursive: true, force: true }); }
});
