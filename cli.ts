#!/usr/bin/env node
import { help, parseOptions, runRalph } from "./ralph.js";

async function main() {
  if (process.argv.slice(2).some(arg => arg === "--help" || arg === "-h")) { console.log(help); return; }
  const controller = new AbortController();
  const interrupt = () => controller.abort(new Error("Interrupted"));
  process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
  try { await runRalph(parseOptions(process.argv.slice(2)), process.cwd(), controller.signal); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = controller.signal.aborted ? 130 : 1; }
  finally { process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt); }
}
void main();
