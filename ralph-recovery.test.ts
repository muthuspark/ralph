import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const mockAgent = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const agent = path.basename(process.argv[1]);
if (process.argv[2] === '--version') process.exit(0);
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const phase = input.match(/PHASE: ([^\\n]+)/)[1];
  const data = JSON.parse(input.split('TASK DATA (JSON):\\n')[1].split('\\n\\n')[0]);
  const desired = (data.completed + 1) * 42;
  fs.appendFileSync('.ralph/calls.jsonl', JSON.stringify({agent, phase, args:process.argv.slice(2), input, data}) + '\\n');
  let result;
  const decisions = [{decision:'Fix the actual value and cover the regression',reason:'Meet the selected acceptance criterion'}];
  if (phase === 'discover') {
    result = {candidates:Array.from({length:5}, (_,i) => ({
      title:'Fix answer ' + data.completed + '-' + i, category:'correctness', rationale:'Fixture', evidence:['app.cjs'],
      acceptanceCriteria:['answer is ' + desired], impact:5, confidence:5, effort:1, risk:1,
      mustDo:{productManager:{score:5,rationale:'Fixture'},subjectMatterExpert:{score:5,rationale:'Fixture',domain:'arithmetic'}}
    }))};
  } else if (phase === 'implement' || phase === 'repair') {
    fs.writeFileSync('app.cjs', 'exports.answer = ' + (desired - 1) + ';\\n');
    result = {summary:'Answer still needs correction', decisions};
  } else if (phase === 'review') {
    if (process.env.RECOVERY_TEST_STOP_REVIEW) process.exit(9);
    const passed = require(path.resolve('app.cjs')).answer === desired;
    result = {summary:passed ? 'Accepted recovery' : 'Answer is incorrect', acceptancePassed:passed,
      acceptanceEvidence:passed ? ['app.test.cjs'] : [], userFacing:false, browserEvidence:[],
      findings:passed ? [] : ['app.cjs:1 expected ' + desired + '; reproduce with node --test app.test.cjs. Add regression coverage.']};
  } else if (phase === 'recover') {
    if (agent !== 'codex' || !data.feedback.length || !input.includes('runDirectory')) process.exit(97);
    const mode = process.env.RECOVERY_TEST_MODE;
    fs.writeFileSync('app.cjs', 'exports.answer = ' + (mode === 'no-fix' || mode === 'crash' ? desired - 1 : desired) + ';\\n');
    if (mode === 'crash') process.exit(12);
    if (mode !== 'no-fix') fs.writeFileSync('app.test.cjs', "const assert = require('node:assert/strict'); assert.equal(require('./app.cjs').answer, " + (mode === 'bad-check' ? desired + 1 : desired) + ");\\n");
    result = {summary:'Codex fixed the reported defect and added a regression test',decisions};
  } else process.exit(98);
  if (agent === 'codex') fs.writeFileSync(process.argv[process.argv.indexOf('--output-last-message') + 1], JSON.stringify(result));
  else process.stdout.write(JSON.stringify({result:JSON.stringify(result)}));
});
`;

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "ralph-recovery-"));
  await mkdir(path.join(root, "bin"));
  await writeFile(path.join(root, ".gitignore"), ".ralph/\n");
  await writeFile(path.join(root, "app.cjs"), "exports.answer = 1;\n");
  await writeFile(path.join(root, "app.test.cjs"), "require('node:assert/strict').ok(Number.isInteger(require('./app.cjs').answer));\n");
  await writeFile(path.join(root, "ralph.config.json"), JSON.stringify({ checks: [{ name: "test", command: [process.execPath, "app.test.cjs"] }], browser: false }));
  for (const name of ["codex", "claude"]) await writeFile(path.join(root, "bin", name), mockAgent, { mode: 0o755 });
  await exec("git", ["init", "-b", "main"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["-c", "user.name=Ralph Test", "-c", "user.email=ralph@example.test", "-c", "commit.gpgsign=false", "commit", "-m", "Fixture"], { cwd: root });
  await exec("git", ["config", "user.name", "Ralph Test"], { cwd: root });
  await exec("git", ["config", "user.email", "ralph@example.test"], { cwd: root });
  await exec("git", ["config", "commit.gpgsign", "false"], { cwd: root });
  const run = (args: string[], env: Record<string, string> = {}) => exec(process.execPath,
    [createRequire(import.meta.url).resolve("tsx/cli"), fileURLToPath(new URL("./cli.ts", import.meta.url)), ...args], {
      cwd: root, env: { ...process.env, PATH: `${path.join(root, "bin")}${path.delimiter}${process.env.PATH}`, ...env },
    });
  const readState = async () => {
    const [id] = (await readdir(path.join(root, ".ralph"))).filter(name => /^\d/.test(name));
    const file = path.join(root, ".ralph", id, "state.json");
    return { file, state: JSON.parse(await readFile(file, "utf8")) };
  };
  const calls = async () => (await readFile(path.join(root, ".ralph/calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
  return { root, run, readState, calls, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("an exhausted legacy checkpoint invokes Codex with findings, then returns to Claude verification and review", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.run(["--goal", "Fix answer", "--agent", "claude", "--model", "claude-only-model", "--iterations", "1", "--max-fix-attempts", "1", "--agent-sandbox", "danger-full-access"], { RECOVERY_TEST_STOP_REVIEW: "1" }));
    const { file, state } = await f.readState();
    state.phase = "repair"; state.repairs = 1;
    state.feedback = ["app.cjs:1 expected 42; add a regression test"];
    state.lastError = "Repair limit (1) exhausted";
    delete state.recoveryAttempts;
    await writeFile(file, JSON.stringify(state));
    const { stdout } = await f.run(["--resume", state.id]);
    assert.match(stdout, /Finished 1 verified iterations/);
    const calls = await f.calls();
    const recovery = calls.find(call => call.phase === "recover");
    assert.equal(recovery.agent, "codex");
    assert.deepEqual(recovery.data.feedback, state.feedback);
    assert.match(recovery.input, /latest review and repair result files/);
    assert.ok(recovery.args.includes("danger-full-access"));
    assert.ok(!recovery.args.includes("claude-only-model"));
    assert.equal(calls.at(-1).agent, "claude");
    assert.equal(calls.at(-1).phase, "review");
    assert.ok(calls.at(-1).args.includes("claude-only-model"));
    assert.equal((await f.readState()).state.completed, 1);
    assert.equal((await exec("git", ["status", "--porcelain"], { cwd: f.root })).stdout, "");
  } finally { await f.cleanup(); }
});

test("ordinary repairs precede recovery and its budget resets only after a verified commit", async () => {
  const f = await fixture();
  try {
    await f.run(["--goal", "Fix answers", "--iterations", "2", "--max-fix-attempts", "1"]);
    const calls = await f.calls();
    for (const completed of [0, 1]) {
      const phases = calls.filter(call => call.data.completed === completed).map(call => call.phase);
      assert.equal(phases.filter(phase => phase === "repair").length, 1);
      assert.equal(phases.filter(phase => phase === "recover").length, 1);
      assert.ok(phases.indexOf("repair") < phases.indexOf("recover"));
      assert.equal(phases.at(-1), "review");
    }
    assert.equal((await f.readState()).state.completed, 2);
    const recovery = calls.find(call => call.phase === "recover");
    assert.ok(recovery.args.includes("workspace-write"));
  } finally { await f.cleanup(); }
});

for (const mode of ["no-fix", "bad-check", "crash"]) {
  test(`unsuccessful recovery (${mode}) preserves edits and cannot gain more attempts by resuming`, async () => {
    const f = await fixture();
    try {
      await assert.rejects(f.run(["--goal", "Fix answer", "--iterations", "1", "--max-fix-attempts", "1"], { RECOVERY_TEST_MODE: mode }));
      const { state } = await f.readState();
      assert.equal(state.completed, 0);
      assert.equal(state.repairs, 1);
      assert.equal(state.recoveryAttempts, 1);
      if (mode === "crash") assert.equal(state.phase, "verify");
      else assert.match(state.lastError, /Codex recovery exhausted/);
      const calls = await f.calls();
      const recoveryIndex = calls.findIndex(call => call.phase === "recover");
      if (mode === "bad-check") assert.equal(calls.length, recoveryIndex + 1);
      if (mode === "crash") {
        // An abrupt orchestrator exit can leave the pre-invocation phase on disk.
        state.phase = "recover";
        await writeFile((await f.readState()).file, JSON.stringify(state));
      }
      await assert.rejects(f.run(["--resume", state.id]), /Codex recovery exhausted/);
      assert.equal((await f.calls()).filter(call => call.phase === "recover").length, 1);
      assert.notEqual(await readFile(path.join(f.root, "app.cjs"), "utf8"), "exports.answer = 1;\n");
      assert.equal((await exec("git", ["log", "--format=%s"], { cwd: f.root })).stdout.trim(), "Fixture");
    } finally { await f.cleanup(); }
  });
}
