import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeRgbBytes, VISUAL_COLOR_TAGS } from "./visual-color-analysis.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogPath = join(root, "src", "data", "generated", "catalog-index.json");
const outputPath = join(root, "src", "data", "generated", "album-visual-index.json");

async function decodeCover(path) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-v", "error", "-i", path, "-vf", "scale=48:48:force_original_aspect_ratio=increase,crop=48:48", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { windowsHide: true });
    const chunks = [];
    let error = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg failed for ${path}: ${error.trim()}`)));
  });
}

export async function generateVisualIndex() {
  const catalogBytes = await readFile(catalogPath);
  const catalog = JSON.parse(catalogBytes.toString("utf8"));
  const albums = new Array(catalog.albums.length);
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < catalog.albums.length) {
      const index = cursor++;
      const album = catalog.albums[index];
    const source = album.cover.thumbnailSrc ?? album.cover.src;
    if (!source?.startsWith("/")) throw new Error(`Album ${album.id} has no local cover.`);
    const coverPath = join(root, "public", ...source.split("/").filter(Boolean));
    const coverBytes = await readFile(coverPath);
    const analysis = analyzeRgbBytes(await decodeCover(coverPath));
      albums[index] = {
      albumId: album.id,
      sourceCover: source,
      sourceCoverSha256: createHash("sha256").update(coverBytes).digest("hex"),
      ...analysis,
      };
      completed += 1;
      if (completed % 100 === 0) process.stderr.write(`Analyzed ${completed}/${catalog.albums.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  const output = {
    version: 1,
    algorithm: "rgb24-48px-hsl-quantized-v1",
    generatedFromCatalogSha256: createHash("sha256").update(catalogBytes).digest("hex"),
    allowedTags: VISUAL_COLOR_TAGS,
    albums,
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = await generateVisualIndex();
  process.stdout.write(`Generated ${output.albums.length} visual records at ${outputPath}\n`);
}
