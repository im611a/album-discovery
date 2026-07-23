import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { resolveStaticFile } from "./static-paths.mjs";

const root = path.resolve(import.meta.dirname, "..", "out");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);
const types = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8" };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}:${port}`).pathname);
  const resolved = resolveStaticFile(root, pathname);
  if (!resolved.file) { response.writeHead(resolved.status).end("Bad request"); return; }
  response.writeHead(resolved.status, { "Content-Type": types[path.extname(resolved.file)] ?? "application/octet-stream" });
  createReadStream(resolved.file).pipe(response);
}).listen(port, host, () => console.log(`Static site: http://${host}:${port}`));
