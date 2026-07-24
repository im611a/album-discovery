import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = path.join(root, "artifacts", `.release-${process.pid}-${Date.now()}`);
const sourceTemporary = path.join(temporary, "album-discovery-source.zip");
const staticTemporary = path.join(temporary, "album-discovery-static-site.zip");
const sourceFinal = path.join(root, "album-discovery-source.zip");
const staticFinal = path.join(root, "album-discovery-static-site.zip");
const reportFinal = path.join(root, "album-discovery-delivery.json");
const reportTemporary = path.join(temporary, "album-discovery-delivery.json");
const started = Date.now();

function run(command, args) {
  return new Promise((resolve, reject) => {
    const windowsPnpm = process.platform === "win32" && command === "pnpm";
    const executable = windowsPnpm ? process.env.ComSpec ?? "cmd.exe" : command;
    const commandArguments = windowsPnpm ? ["/d", "/s", "/c", "pnpm", ...args] : args;
    const child = spawn(executable, commandArguments, { cwd: root, stdio: "inherit", shell: false });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)));
    child.on("error", reject);
  });
}
async function capture(command, args) {
  return new Promise((resolve, reject) => {
    let output = "";
    const windowsPnpm = process.platform === "win32" && command === "pnpm";
    const executable = windowsPnpm ? process.env.ComSpec ?? "cmd.exe" : command;
    const commandArguments = windowsPnpm ? ["/d", "/s", "/c", "pnpm", ...args] : args;
    const child = spawn(executable, commandArguments, { cwd: root, shell: false });
    child.stdout.on("data", (data) => { output += data; });
    child.on("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} failed`)));
  });
}
async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function verifyStaticHttp() {
  const port = 4199;
  const server = spawn("node", ["scripts/serve-static.mjs"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`);
        if (response.ok) { ready = true; break; }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!ready) throw new Error("Static HTTP server did not become ready.");
    for (const route of ["/", "/discover/", "/explore/", "/genres/", "/genres/core/pop/", "/scenes/night/", "/decades/2000s/", "/about/", "/albums/ok-computer/"]) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`);
      if (!response.ok) throw new Error(`Static HTTP verification failed for ${route}: ${response.status}`);
    }
  } finally {
    server.kill();
  }
}

const status = await capture("git", ["status", "--porcelain"]);
if (status) throw new Error("release:prepare requires a clean worktree so the manifest and archives identify one exact commit.");
await mkdir(temporary, { recursive: true });
try {
  for (const [command, args] of [
    ["pnpm", ["catalog:validate"]],
    ["pnpm", ["lint"]],
    ["pnpm", ["typecheck"]],
    ["pnpm", ["test"]],
    ["pnpm", ["build"]],
    ["pnpm", ["test:static-links"]],
  ]) await run(command, args);
  await verifyStaticHttp();
  for (const [command, args] of [
    ["node", ["scripts/package-source.mjs", "--output", sourceTemporary]],
    ["node", ["scripts/package-static.mjs", "--output", staticTemporary]],
    ["node", ["scripts/verify-delivery.mjs", "--source", sourceTemporary, "--static", staticTemporary]],
  ]) await run(command, args);
  const [branch, commit, catalog, artists, releaseManifest] = await Promise.all([
    capture("git", ["branch", "--show-current"]),
    capture("git", ["rev-parse", "--short", "HEAD"]),
    readFile(path.join(root, "src/data/generated/catalog-index.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "src/data/generated/artist-index.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "out/release-manifest.json"), "utf8").then(JSON.parse),
  ]);
  const [sourceInfo, staticInfo, sourceHash, staticHash] = await Promise.all([
    stat(sourceTemporary), stat(staticTemporary), sha256(sourceTemporary), sha256(staticTemporary),
  ]);
  const report = {
    branch, commit, builtAt: releaseManifest.builtAt,
    catalogCount: catalog.albums.length, artistCount: artists.artists.length,
    ratedAlbumCount: releaseManifest.ratedAlbumCount,
    relatedGenreAlbumCount: releaseManifest.relatedGenreAlbumCount,
    staticPageCount: releaseManifest.staticPageCount,
    sourceZip: { bytes: sourceInfo.size, sha256: sourceHash },
    staticZip: { bytes: staticInfo.size, sha256: staticHash },
    durationMs: Date.now() - started,
  };
  await writeFile(reportTemporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const replacements = [
    { final: sourceFinal, next: sourceTemporary, backup: `${sourceFinal}.previous`, hadPrevious: false, installed: false },
    { final: staticFinal, next: staticTemporary, backup: `${staticFinal}.previous`, hadPrevious: false, installed: false },
    { final: reportFinal, next: reportTemporary, backup: `${reportFinal}.previous`, hadPrevious: false, installed: false },
  ];
  try {
    for (const item of replacements) {
      await rm(item.backup, { force: true });
      if (existsSync(item.final)) {
        await rename(item.final, item.backup);
        item.hadPrevious = true;
      }
      await rename(item.next, item.final);
      item.installed = true;
    }
  } catch (error) {
    for (const item of [...replacements].reverse()) {
      if (item.installed) await rm(item.final, { force: true });
      if (item.hadPrevious && existsSync(item.backup)) await rename(item.backup, item.final);
    }
    throw error;
  }
  for (const item of replacements) await rm(item.backup, { force: true });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
