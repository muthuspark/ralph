import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseProgress, parseServerOptions, startProgressServer } from "./ralph-server.js";

const record = (event: string, body: string) => `\n[2026-10-19T14:05:45.445Z] run-1 — ${event}\n${body}\n`;

test("progress parser preserves structured, partial, and plain text entries", () => {
  const entries = parseProgress("# Ralph progress\n" + record("Phase started", '{"iteration":1,"phase":"verify"}') +
    record("Decision", "plain text") + record("Partial", '{"summary":'));
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { timestamp: "2026-10-19T14:05:45.445Z", run: "run-1", event: "Phase started", details: { iteration: 1, phase: "verify" } });
  assert.equal(entries[1].details, "plain text");
  assert.equal(entries[2].details, '{"summary":');
  assert.equal(parseProgress(record("CRLF", '{"ok":true}').replaceAll("\n", "\r\n")).length, 1);
});

test("server options validate ports and reject unknown or duplicate flags", () => {
  assert.deepEqual(parseServerOptions([]), { port: 4317, open: true });
  assert.deepEqual(parseServerOptions(["--no-open", "--port", "8080"]), { port: 8080, open: false });
  for (const args of [["--port"], ["--port", "0"], ["--port", "65536"], ["--port", "1.5"], ["--port", "abc"], ["--host", "0.0.0.0"], ["--no-open", "--no-open"]]) {
    assert.throws(() => parseServerOptions(args));
  }
});

test("progress server follows creation, appends, replacement, deletion, and read errors", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ralph-server-"));
  const server = await startProgressServer(root, 0);
  try {
    const address = server.address() as AddressInfo;
    assert.equal(address.address, "127.0.0.1");
    const url = `http://127.0.0.1:${address.port}`;
    const read = () => fetch(`${url}/api/progress`);
    const missing = await (await read()).json();
    assert.equal(missing.exists, false);
    assert.deepEqual(missing.entries, []);
    assert.equal(missing.file, path.join(root, "progress.txt"));
    const file = path.join(root, "progress.txt");
    await writeFile(file, record("Run started", '{"goal":"Ship it"}'));
    const first = await read();
    const etag = first.headers.get("etag")!;
    assert.equal((await first.json()).entries.length, 1);
    assert.equal((await fetch(`${url}/api/progress`, { headers: { "If-None-Match": etag } })).status, 304);
    await appendFile(file, record("Check passed", '{"command":"npm test"}'));
    const changed = await fetch(`${url}/api/progress`, { headers: { "If-None-Match": etag } });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).entries.length, 2);
    await writeFile(file, "Legacy log <script>alert('unsafe')</script>");
    const legacy = await (await read()).json();
    assert.equal(legacy.entries.length, 0);
    assert.match(legacy.text, /Legacy log/);
    const html = await fetch(url);
    assert.match(html.headers.get("content-type")!, /text\/html/);
    assert.match(await html.text(), /Ralph/);
    assert.equal((await fetch(`${url}/package.json`)).status, 404);
    assert.equal((await fetch(`${url}/api/progress`, { method: "POST" })).status, 405);
    await rm(file);
    assert.equal((await (await read()).json()).exists, false);
    // A directory at the file path is a read error, not an empty log.
    await mkdir(file);
    assert.equal((await read()).status, 500);
    const occupied = server.address() as AddressInfo;
    await assert.rejects(startProgressServer(root, occupied.port), { code: "EADDRINUSE" });
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
    await rm(root, { recursive: true, force: true });
  }
});

test("server CLI runs outside a Git repository and shuts down on SIGINT", { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ralph-server-cli-"));
  const probe = await startProgressServer(root, 0);
  const port = (probe.address() as AddressInfo).port;
  probe.close(); await once(probe, "close");
  const child = spawn(process.execPath, [createRequire(import.meta.url).resolve("tsx/cli"),
    fileURLToPath(new URL("./cli.ts", import.meta.url)), "server", "--port", String(port), "--no-open"], { cwd: root });
  try {
    const [output] = await once(child.stdout, "data", { signal: AbortSignal.timeout(10000) });
    assert.match(String(output), /Ralph progress: http:\/\/127.0.0.1:/);
    const response = await fetch(`http://127.0.0.1:${port}/api/progress`);
    assert.equal((await response.json()).exists, false);
    const closed = once(child, "close");
    child.kill("SIGINT");
    const [code] = await closed;
    assert.equal(code, 0);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await rm(root, { recursive: true, force: true });
  }
});
