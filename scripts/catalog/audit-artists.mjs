import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const catalog = JSON.parse(await readFile(path.join(root, "src/data/generated/catalog.json"), "utf8"));
const artistIndex = JSON.parse(await readFile(path.join(root, "src/data/generated/artist-index.json"), "utf8"));
const normalize = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
const onlyPunctuation = (value) => !String(value ?? "").match(/[\p{L}\p{N}]/u);
const idsToSlugs = new Map();
const slugsToIds = new Map();
const normalizedNames = new Map();
for (const artist of artistIndex.artists) {
  idsToSlugs.set(artist.neteaseArtistId, [...(idsToSlugs.get(artist.neteaseArtistId) ?? []), artist.slug]);
  slugsToIds.set(artist.slug, [...(slugsToIds.get(artist.slug) ?? []), artist.neteaseArtistId]);
  const name = normalize(artist.name);
  normalizedNames.set(name, [...(normalizedNames.get(name) ?? []), artist.neteaseArtistId]);
}
const duplicateArtistIds = [...idsToSlugs].filter(([, slugs]) => new Set(slugs).size > 1);
const duplicateSlugs = [...slugsToIds].filter(([, ids]) => new Set(ids).size > 1);
const sameNormalizedNameDifferentIds = [...normalizedNames]
  .filter(([name, ids]) => name && new Set(ids).size > 1)
  .map(([name, ids]) => ({ name, artistIds: [...new Set(ids)] }));
const invalidArtists = artistIndex.artists.filter((artist) => !artist.name.trim() || onlyPunctuation(artist.name));
const membershipErrors = [];
for (const artist of artistIndex.artists) {
  for (const albumId of artist.albumIds) {
    const album = catalog.albums.find((item) => item.id === albumId);
    if (!album || !album.artists.some((item) => item.neteaseArtistId === artist.neteaseArtistId)) {
      membershipErrors.push({ artistId: artist.neteaseArtistId, albumId });
    }
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  beforeArtistCount: artistIndex.artists.length,
  afterArtistCount: artistIndex.artists.length,
  automaticMergeCount: 0,
  duplicateArtistIdCount: duplicateArtistIds.length,
  duplicateSlugCount: duplicateSlugs.length,
  conflictingArtistIdCount: duplicateSlugs.length,
  invalidArtistCount: invalidArtists.length,
  retainedSameNameDifferentArtistCount: sameNormalizedNameDifferentIds.length,
  membershipErrorCount: membershipErrors.length,
  duplicateArtistIds,
  duplicateSlugs,
  sameNormalizedNameDifferentIds,
  invalidArtists: invalidArtists.map((artist) => ({ id: artist.neteaseArtistId, name: artist.name })),
  membershipErrors,
  rules: [
    "同一网易云 artistId 只能生成一个 artist-{id} slug。",
    "仅名称相似不会自动合并不同 artistId。",
    "合作艺人由网易云结构化 artists 数组决定，不拆分名称字符串。",
    "曲目客串艺人不会进入专辑主艺人索引。",
  ],
};
await writeFile(path.join(root, "reports/catalog/artist-identity-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
