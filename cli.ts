#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { help, parseOptions, runRalph } from "./ralph.js";
import { parseServerOptions, startProgressServer } from "./ralph-server.js";

async function main() {
  if (process.argv.slice(2).some(arg => arg === "--help" || arg === "-h")) { console.log(help); return; }
  if (process.argv.slice(2).includes("--version")) {
    // The source CLI lives beside package.json; the published CLI lives in dist/.
    const localPackage = new URL("./package.json", import.meta.url);
    const packageFile = existsSync(localPackage) ? localPackage : new URL("../package.json", import.meta.url);
    console.log(JSON.parse(readFileSync(packageFile, "utf8")).version);
    return;
  }
  const controller = new AbortController();
  const interrupt = () => controller.abort(new Error("Interrupted"));
  process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
  try {
    const args = process.argv.slice(2);
    if (args[0] === "server") {
      const options = parseServerOptions(args.slice(1));
      const server = await startProgressServer(process.cwd(), options.port);
      const url = `http://127.0.0.1:${options.port}`;
      console.log(`Ralph progress: ${url}\nWatching ${process.cwd()}/progress.txt\nPress Ctrl+C to stop.`);
      if (options.open) {
        const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer.exe" : "xdg-open";
        const browser = spawn(command, [url], { stdio: "ignore" });
        browser.on("error", () => console.log(`Open ${url} in your browser.`));
        browser.unref();
      }
      await new Promise<void>(resolve => {
        const close = () => { server.closeAllConnections(); server.close(() => resolve()); };
        controller.signal.addEventListener("abort", close, { once: true });
        server.once("close", () => controller.signal.removeEventListener("abort", close));
        if (controller.signal.aborted) close();
      });
    } else {
      await runRalph(parseOptions(args), process.cwd(), controller.signal);
    }
  }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = controller.signal.aborted ? 130 : 1; }
  finally { process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt); }
}
void main();
