import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { progressPage } from "./ralph-server-page.js";

export type ProgressEntry = { timestamp: string; run: string; event: string; details: unknown };

export function parseProgress(text: string): ProgressEntry[] {
  const headers = [...text.matchAll(/^\[(\d{4}-\d{2}-\d{2}T[^\]\r\n]+)\] ([^\r\n]+?) — ([^\r\n]+)\r?$/gm)];
  return headers.map((header, index) => {
    const body = text.slice(header.index! + header[0].length, headers[index + 1]?.index ?? text.length).trim();
    let details: unknown = body;
    try { details = JSON.parse(body); } catch { /* Preserve partial writes and plain text. */ }
    return { timestamp: header[1], run: header[2], event: header[3], details };
  });
}

export async function startProgressServer(root: string, port = 4317) {
  const file = path.resolve(root, "progress.txt");
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const route = new URL(request.url ?? "/", "http://localhost").pathname;
    if (route === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : progressPage);
      return;
    }
    if (route !== "/api/progress") { response.writeHead(404).end("Not found"); return; }
    try {
      let text = "", exists = true;
      try { text = await readFile(file, "utf8"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        exists = false;
      }
      const etag = '"' + createHash("sha256").update(String(exists)).update(text).digest("hex") + '"';
      response.setHeader("ETag", etag);
      if (request.headers["if-none-match"] === etag) { response.writeHead(304).end(); return; }
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : JSON.stringify({ file, exists, text, entries: parseProgress(text) }));
    } catch {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Could not read progress.txt. Check the file's permissions and try again." }));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
  });
  return server;
}

export function parseServerOptions(args: string[]) {
  let port = 4317, open = true;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--no-open") { open = false; continue; }
    if (flag !== "--port") throw new Error(`Unknown server option: ${flag}`);
    const value = args[++index];
    if (!value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error("--port must be an integer from 1 to 65535");
    port = Number(value);
  }
  return { port, open };
}
