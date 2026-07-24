import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { cpus, platform, release, totalmem } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../../src/data/generated/catalog-index.json" with { type: "json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requested = Number(process.argv[process.argv.indexOf("--count") + 1] ?? 1000);
if (!Number.isInteger(requested) || requested < 1 || requested > 50_000) throw new Error("--count must be an integer from 1 to 50000.");

const measure = (run) => {
  const before = performance.now();
  const value = run();
  return { milliseconds: Number((performance.now() - before).toFixed(3)), value };
};
const memoryBefore = process.memoryUsage().heapUsed;
const generated = measure(() => Array.from({ length: requested }, (_, index) => {
  const source = catalog.albums[index % catalog.albums.length];
  return {
    ...source,
    id: `synthetic:${index}`,
    internalId: `synthetic:${index}`,
    slug: `synthetic-${index}`,
    title: `${source.title} Synthetic ${index}`,
    searchText: `${source.searchText} synthetic ${index}`,
    releaseYear: source.releaseYear == null ? null : source.releaseYear - (index % 3),
    rymRating: index % 17 === 0 ? 3 + (index % 20) / 10 : null,
  };
}));
const albums = generated.value;
const serialized = measure(() => JSON.stringify(albums));
const searchIndex = measure(() => albums.map((album) => [album.id, album.searchText.toLocaleLowerCase("zh-CN")]));
const coreFilter = measure(() => albums.filter((album) => album.coreGenres.includes("pop")));
const decadeFilter = measure(() => albums.filter((album) => album.releaseYear != null && album.releaseYear >= 2000 && album.releaseYear < 2010));
const typeFilter = measure(() => albums.filter((album) => album.albumType === "album"));
const rymSort = measure(() => [...albums].sort((a, b) => Number(b.rymRating != null) - Number(a.rymRating != null) || (b.rymRating ?? 0) - (a.rymRating ?? 0) || a.title.localeCompare(b.title, "zh-CN")));
const fallbackSort = measure(() => [...albums].sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || a.title.localeCompare(b.title, "zh-CN")));
const search = measure(() => searchIndex.value.filter(([, value]) => value.includes("love")).slice(0, 40));
const pagination = measure(() => albums.slice(48 * 10, 48 * 11));
const similar = measure(() => albums.slice(1).map((album) => ({
  id: album.id,
  score: album.coreGenres.filter((genre) => albums[0].coreGenres.includes(genre)).length * 5 +
    album.relatedGenres.filter((genre) => albums[0].relatedGenres.includes(genre)).length * 3,
})).sort((a, b) => b.score - a.score).slice(0, 6));
const targetShardBytes = 512 * 1024;
const shardCount = Math.max(1, Math.ceil(Buffer.byteLength(serialized.value) / targetShardBytes));
const report = {
  synthetic: true,
  count: requested,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
  },
  timingsMs: {
    indexGeneration: generated.milliseconds,
    serialization: serialized.milliseconds,
    searchIndexGeneration: searchIndex.milliseconds,
    coreGenreFilter: coreFilter.milliseconds,
    decadeFilter: decadeFilter.milliseconds,
    releaseTypeFilter: typeFilter.milliseconds,
    rymSort: rymSort.milliseconds,
    fallbackSort: fallbackSort.milliseconds,
    searchQuery: search.milliseconds,
    pagination: pagination.milliseconds,
    similarAlbums: similar.milliseconds,
  },
  indexBytes: Buffer.byteLength(serialized.value),
  approximateHeapDeltaBytes: Math.max(0, process.memoryUsage().heapUsed - memoryBefore),
  proposedShards: {
    count: shardCount,
    targetBytes: targetShardBytes,
    maxApproximateBytes: Math.ceil(Buffer.byteLength(serialized.value) / shardCount),
  },
};
const outputDirectory = path.join(root, ".cache", "catalog", "benchmark");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, `latest-${requested}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
