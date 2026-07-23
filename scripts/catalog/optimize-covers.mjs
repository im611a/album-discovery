import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceDirectory = path.join(root, "public", "catalog", "covers");
const thumbnailDirectory = path.join(sourceDirectory, "thumb");
const detailDirectory = path.join(sourceDirectory, "detail");
const reportPath = path.join(root, "reports", "catalog", "cover-optimization.json");
const catalogPath = path.join(root, "src", "data", "generated", "catalog.json");

const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
  let error = "";
  child.stderr.on("data", (chunk) => { error += chunk; });
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${error}`)));
});

async function transcode(input, output, size, quality) {
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-vf", `scale=${size}:${size}:force_original_aspect_ratio=decrease`,
    "-c:v", "libwebp", "-quality", String(quality), "-compression_level", "6",
    output,
  ]);
}

async function mapLimit(values, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < values.length) {
      const current = values[cursor];
      cursor += 1;
      await worker(current);
    }
  }));
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const localIds = new Set(catalog.albums.filter((album) => album.cover?.kind === "local").map((album) => album.neteaseAlbumId));
const sourceFiles = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d+\.jpg$/i.test(entry.name))
  .map((entry) => entry.name);
const sourceBytes = (await Promise.all(sourceFiles.map((name) => stat(path.join(sourceDirectory, name))))).reduce((sum, value) => sum + value.size, 0);
const orphanFiles = sourceFiles.filter((name) => !localIds.has(path.basename(name, ".jpg")));
await Promise.all(orphanFiles.map((name) => rm(path.join(sourceDirectory, name), { force: true })));
const activeFiles = sourceFiles.filter((name) => localIds.has(path.basename(name, ".jpg")));
const hashes = new Map();
const duplicateIds = [];
for (const name of activeFiles) {
  const hash = await sha256(path.join(sourceDirectory, name));
  if (hashes.has(hash)) duplicateIds.push([path.basename(name, ".jpg"), hashes.get(hash)]);
  else hashes.set(hash, path.basename(name, ".jpg"));
}
await Promise.all([mkdir(thumbnailDirectory, { recursive: true }), mkdir(detailDirectory, { recursive: true })]);
const duplicateIdSet = new Set(duplicateIds.map(([duplicateId]) => duplicateId));
await mapLimit(activeFiles.filter((name) => !duplicateIdSet.has(path.basename(name, ".jpg"))), 4, async (name) => {
  const id = path.basename(name, ".jpg");
  const thumbnail = path.join(thumbnailDirectory, `${id}.webp`);
  const detail = path.join(detailDirectory, `${id}.webp`);
  await Promise.all([
    transcode(path.join(sourceDirectory, name), thumbnail, 360, 76),
    transcode(path.join(sourceDirectory, name), detail, 960, 82),
  ]);
});
for (const [duplicateId, canonicalId] of duplicateIds) {
  await Promise.all([
    cp(path.join(thumbnailDirectory, `${canonicalId}.webp`), path.join(thumbnailDirectory, `${duplicateId}.webp`)),
    cp(path.join(detailDirectory, `${canonicalId}.webp`), path.join(detailDirectory, `${duplicateId}.webp`)),
  ]);
}
for (const directory of [thumbnailDirectory, detailDirectory]) {
  for (const name of await readdir(directory)) {
    if (/^\d+\.webp$/i.test(name) && !localIds.has(path.basename(name, ".webp"))) {
      await rm(path.join(directory, name), { force: true });
    }
  }
}
const outputFiles = [
  ...(await readdir(thumbnailDirectory)).map((name) => path.join(thumbnailDirectory, name)),
  ...(await readdir(detailDirectory)).map((name) => path.join(detailDirectory, name)),
];
const outputBytes = (await Promise.all(outputFiles.map(stat))).reduce((sum, value) => sum + value.size, 0);
const report = {
  generatedAt: new Date().toISOString(),
  originalCount: activeFiles.length,
  originalBytes: sourceBytes,
  thumbnailCount: (await readdir(thumbnailDirectory)).length,
  detailCount: (await readdir(detailDirectory)).length,
  optimizedBytes: outputBytes,
  orphanCount: orphanFiles.length,
  duplicateCount: duplicateIds.length,
  duplicateIds,
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
