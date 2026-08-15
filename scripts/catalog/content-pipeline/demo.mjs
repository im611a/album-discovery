import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createBatchWorkspace, runDryRun } from "./pipeline.mjs";
import { stableJson } from "./utils.mjs";

const run = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const demoRoot = path.join(repositoryRoot, ".local-data", "content-pipeline-v1", "CONTENT-BATCH-20260815-900-DEMO");
const batchId = "CONTENT-BATCH-20260815-900";
const fixedTimestamp = "2026-08-15T00:00:00.000Z";

function payload({ albumId, title, artists, releaseDate = "2026-01-01", type = "album" }) {
  return {
    album: {
      id: Number(albumId),
      name: title,
      artists: artists.map((artist) => ({ id: Number(artist.neteaseArtistId), name: artist.name })),
      publishTime: Date.parse(`${releaseDate}T00:00:00.000Z`),
      type,
      company: "Synthetic Content Pipeline Fixture",
    },
    songs: [1, 2].map((trackNumber) => ({
      id: Number(`${albumId}${trackNumber}`),
      name: `Synthetic Track ${trackNumber}`,
      no: trackNumber,
      cd: "1",
      dt: 180_000 + trackNumber,
      ar: artists.map((artist) => ({ id: Number(artist.neteaseArtistId), name: artist.name })),
    })),
  };
}

async function createCover(file, index) {
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
    `color=c=blue:s=${180 + index * 2}x240`,
    "-frames:v", "1", file,
  ], { windowsHide: true });
}

export async function generateDemo() {
  if (!demoRoot.startsWith(path.join(repositoryRoot, ".local-data", "content-pipeline-v1"))) throw new Error("Unsafe demo path.");
  await rm(demoRoot, { recursive: true, force: true });
  await createBatchWorkspace(demoRoot, { id: batchId, discoveredAt: fixedTimestamp });
  const catalog = JSON.parse(await readFile(path.join(repositoryRoot, "src", "data", "generated", "catalog.json"), "utf8"));
  const reference = catalog.albums.find((album) => album.neteaseAlbumId !== "281405720" && album.artists.every((artist) => Number(artist.neteaseArtistId) > 0));
  const coreGenre = reference.coreGenres[0];
  const rows = [];
  const proposals = [
    { albumId: "9901001", title: "A Synthetic Archive With an Intentionally Long Listening Title", artists: [{ neteaseArtistId: "9000001001", name: "Synthetic New Artist" }], case: "CLEAN_READY" },
    { albumId: "9901002", title: "Synthetic Slug Collision", artists: [{ neteaseArtistId: "9000001002", name: "Synthetic Collision Artist A" }], case: "SLUG_COLLISION_A" },
    { albumId: "9901003", title: "Synthetic Slug Collision", artists: [{ neteaseArtistId: "9000001003", name: "Synthetic Collision Artist B" }], case: "SLUG_COLLISION_B" },
    { albumId: "9901004", title: "Synthetic Ambiguous Credit", artists: [{ neteaseArtistId: "0", name: reference.artists[0].name }], case: "AMBIGUOUS_ARTIST" },
    { albumId: "9901005", title: `${reference.title} Deluxe Edition`, artists: reference.artists, releaseDate: reference.releaseDate, type: reference.albumType, case: "POSSIBLE_EDITION" },
    { albumId: "9901006", title: "Synthetic Invalid Artist Identity", artists: [{ neteaseArtistId: "0", name: "Synthetic Unknown Artist" }], case: "INVALID_ARTIST_ID" },
    { albumId: "9901007", title: "Synthetic Missing Cover", artists: [{ neteaseArtistId: "9000001007", name: "Synthetic Missing Cover Artist" }], case: "MISSING_COVER", missingCover: true },
    { albumId: "9901008", title: reference.title, artists: reference.artists, releaseDate: reference.releaseDate, type: reference.albumType, case: "LIKELY_DUPLICATE" },
  ];
  rows.push([reference.neteaseAlbumId, reference.title, reference.artists.map((artist) => artist.name).join("|"), coreGenre, "", "", "synthetic-demo:exact-duplicate", "", "", "false"]);
  let index = 0;
  for (const proposal of proposals) {
    index += 1;
    const coverName = `${proposal.albumId}.png`;
    rows.push([proposal.albumId, proposal.title, proposal.artists.map((artist) => artist.name).join("|"), coreGenre, "focus", coverName, `synthetic-demo:${proposal.case}`, "", "", "false"]);
    await writeFile(path.join(demoRoot, "input", "payloads", `${proposal.albumId}.json`), stableJson(payload(proposal)), "utf8");
    if (!proposal.missingCover) await createCover(path.join(demoRoot, "incoming-covers", coverName), index);
  }
  const encode = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const header = ["album_id", "expected_title", "expected_artists", "core_genres", "contexts", "cover_file", "source_reference", "discovered_at", "slug_override", "refresh"];
  await writeFile(path.join(demoRoot, "input", "input.csv"), `${[header, ...rows].map((row) => row.map(encode).join(",")).join("\n")}\n`, "utf8");
  await mkdir(path.join(demoRoot, "transaction"), { recursive: true });
  await writeFile(path.join(demoRoot, "transaction", "FOUNDATION_ONLY.txt"), "No production promotion was performed. Transaction behavior is covered by isolated fixture tests.\n", "utf8");
  return runDryRun({ batchRoot: demoRoot });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await generateDemo();
  console.log(JSON.stringify({ status: "SYNTHETIC_DEMO_GENERATED", batchRoot: demoRoot, counts: result.report.counts, resultFingerprint: result.report.resultFingerprint, productionMutation: false }, null, 2));
}
