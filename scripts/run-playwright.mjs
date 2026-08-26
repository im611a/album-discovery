import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const host = "127.0.0.1";
const port = "4311";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const healthUrl = `http://${host}:${port}${basePath}/`;
let server = null;

function runPlaywright() {
  const binary = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "playwright.CMD" : "playwright");
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : binary;
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", binary, "test", ...process.argv.slice(2)]
    : ["test", ...process.argv.slice(2)];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: false });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", reject);
  });
}

try {
  let ready = false;
  try {
    ready = (await fetch(healthUrl)).ok;
  } catch {
    // Start the repository static server below.
  }
  if (!ready) {
    server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
      cwd: root,
      env: { ...process.env, HOST: host, PORT: port },
      stdio: ["ignore", "pipe", "inherit"],
    });
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (ready) break;
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw new Error("Static test server did not become ready.");
  process.exitCode = await runPlaywright();
} finally {
  server?.kill();
}
