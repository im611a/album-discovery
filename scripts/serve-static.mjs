import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "out");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);
const types = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".xml": "application/xml; charset=utf-8" };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}:${port}`).pathname);
  const requested = path.resolve(root, `.${pathname}`);
  if (!requested.startsWith(root)) { response.writeHead(400).end("Bad request"); return; }
  const candidate = existsSync(requested) && statSync(requested).isDirectory() ? path.join(requested, "index.html") : requested;
  const file = existsSync(candidate) && statSync(candidate).isFile() ? candidate : path.join(root, "404.html");
  response.writeHead(file === candidate ? 200 : 404, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, host, () => console.log(`Static site: http://${host}:${port}`));
