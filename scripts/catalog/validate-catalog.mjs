import path from "node:path";
import { existsSync } from "node:fs";
import { OUTPUT_DIR, ROOT, isSafeExternalUrl, readJson } from "./lib/catalog-utils.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RELEASE_TYPES = new Set(["album", "ep", "mixtape", "live", "compilation", "other"]);
const issues = [];
const add = (pathName, message) => issues.push(`${pathName}: ${message}`);
const catalog = await readJson(path.join(OUTPUT_DIR, "catalog.json"));
if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.albums)) throw new Error("Published catalog is missing or has an unsupported version.");

const taxonomyKeys = new Set((catalog.taxonomy ?? []).map((item) => item.key));
const ids = new Set();
const slugs = new Set();
let flagshipCount = 0;
for (const [index, album] of catalog.albums.entries()) {
  const base = `albums[${index}]`;
  if (!album.id || ids.has(album.id)) add(`${base}.id`, "missing or duplicate album ID");
  ids.add(album.id);
  if (!album.slug || slugs.has(album.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(album.slug)) add(`${base}.slug`, "missing, duplicate, or unstable slug");
  slugs.add(album.slug);
  if (!UUID.test(album.musicbrainzReleaseGroupId)) add(`${base}.musicbrainzReleaseGroupId`, "invalid MusicBrainz UUID");
  if (!String(album.title ?? "").trim()) add(`${base}.title`, "blank title");
  if (!Array.isArray(album.artists) || !album.artists.some((artist) => String(artist.name ?? "").trim())) add(`${base}.artists`, "at least one artist is required");
  if (album.releaseDate && !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(album.releaseDate.value)) add(`${base}.releaseDate`, "invalid partial date");
  if (!RELEASE_TYPES.has(album.releaseType)) add(`${base}.releaseType`, "unsupported release type");
  for (const key of album.primaryGenres ?? []) if (!taxonomyKeys.has(key)) add(`${base}.primaryGenres`, `unknown taxonomy key ${key}`);
  if (album.cover?.kind === "local") {
    const localPath = path.join(ROOT, "public", album.cover.src.replace(/^\//, ""));
    if (!existsSync(localPath)) add(`${base}.cover`, `missing local cover ${album.cover.src}`);
  } else if (album.cover?.kind !== "fallback") add(`${base}.cover`, "cover must be local or fallback");
  const platforms = new Set();
  for (const [linkIndex, link] of (album.externalLinks ?? []).entries()) {
    if (!isSafeExternalUrl(link.url)) add(`${base}.externalLinks[${linkIndex}]`, "unsafe URL");
    if (platforms.has(link.platform)) add(`${base}.externalLinks[${linkIndex}]`, `duplicate platform ${link.platform}`);
    platforms.add(link.platform);
  }
  const trackIds = new Set();
  for (const [trackIndex, track] of (album.tracks ?? []).entries()) {
    if (!track.id || trackIds.has(track.id)) add(`${base}.tracks[${trackIndex}]`, "missing or duplicate track ID");
    trackIds.add(track.id);
    if (!String(track.title ?? "").trim() || track.title === "曲名暂缺") add(`${base}.tracks[${trackIndex}].title`, "placeholder or blank track title");
    if (!Number.isInteger(track.trackNumber) || track.trackNumber < 1) add(`${base}.tracks[${trackIndex}].trackNumber`, "invalid track number");
  }
  if (album.editorial) {
    flagshipCount += 1;
    if (album.editorial.confidence === "curated" && !album.editorial.humanReviewed) add(`${base}.editorial`, "curated status requires human review");
    if (!album.editorial.summaryZh || !album.editorial.whyListenZh) add(`${base}.editorial`, "summary and listening guidance are required");
    if ((album.descriptors ?? []).length < 2 || (album.contexts ?? []).length < 1) add(`${base}.editorial`, "flagship needs descriptors and contexts");
    if (album.editorial.startWithTrackId && !trackIds.has(album.editorial.startWithTrackId)) add(`${base}.editorial.startWithTrackId`, "track does not exist");
    if (!(album.externalLinks ?? []).some((link) => link.verified)) add(`${base}.externalLinks`, "flagship needs a verified outbound destination");
  }
  if (/rymRating|fictional|mock album|placeholder/i.test(JSON.stringify(album))) add(base, "production fixture or fictional rating marker detected");
}
if (catalog.albums.length < 120) add("catalog.albums", `minimum is 120, got ${catalog.albums.length}`);
if (flagshipCount < 24) add("catalog.flagships", `minimum is 24, got ${flagshipCount}`);
if (taxonomyKeys.size < 12) add("catalog.taxonomy", `minimum is 12, got ${taxonomyKeys.size}`);
if (issues.length) { console.error(`Catalog validation failed with ${issues.length} issue(s):\n- ${issues.join("\n- ")}`); process.exit(1); }
console.log(`Catalog valid: ${catalog.albums.length} real albums, ${flagshipCount} flagship guides, ${taxonomyKeys.size} primary genres.`);
