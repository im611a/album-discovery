import type { PublishedAlbumSummary } from "../schema";

export const PERSONAL_JOURNEY_SOURCES = ["home", "for-you", "album", "artist", "explore"] as const;
export type PersonalJourneySource = (typeof PERSONAL_JOURNEY_SOURCES)[number];

export interface PersonalJourneyUrlContext {
  readonly source: PersonalJourneySource | null;
  readonly trailAlbumSlugs: readonly string[];
}

const MAX_URL_TRAIL = 4;
const MAX_RAW_LENGTH = 512;

function newestUnique(values: readonly string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (seen.has(value)) continue;
    seen.add(value);
    output.unshift(value);
  }
  return output.slice(-MAX_URL_TRAIL);
}

export function parsePersonalJourneyUrlContext(input: string | URLSearchParams, catalog: readonly PublishedAlbumSummary[]): PersonalJourneyUrlContext {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const rawTrail = params.get("ptrail");
  const slugs = new Set(catalog.map((album) => album.slug));
  const sourceValue = params.get("pfrom");
  return Object.freeze({
    source: PERSONAL_JOURNEY_SOURCES.includes(sourceValue as PersonalJourneySource) ? sourceValue as PersonalJourneySource : null,
    trailAlbumSlugs: Object.freeze(rawTrail && rawTrail.length <= MAX_RAW_LENGTH
      ? newestUnique(rawTrail.split("~").filter((slug) => slugs.has(slug)))
      : []),
  });
}

export function buildPersonalJourneyAlbumHref({
  targetSlug,
  source,
  currentAlbumSlug,
  searchParams = "",
  catalog,
}: {
  targetSlug: string;
  source: PersonalJourneySource;
  currentAlbumSlug?: string;
  searchParams?: string | URLSearchParams;
  catalog: readonly PublishedAlbumSummary[];
}) {
  const incoming = parsePersonalJourneyUrlContext(searchParams, catalog);
  const params = new URLSearchParams();
  const sourceParams = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
  for (const key of ["entry", "entryKey", "trail", "via"]) {
    const value = sourceParams.get(key);
    if (value && value.length <= MAX_RAW_LENGTH) params.set(key, value);
  }
  const trail = newestUnique([...incoming.trailAlbumSlugs, ...(currentAlbumSlug ? [currentAlbumSlug] : [])]);
  params.set("pfrom", source);
  if (trail.length) params.set("ptrail", trail.join("~"));
  const query = params.toString();
  return query ? `/albums/${targetSlug}?${query}` : `/albums/${targetSlug}/`;
}
