import { parseDiscoveryPathContext, serializeDiscoveryPathContext } from "./discovery/path-context";
import { publishedDiscoveryIndex } from "./discovery/published-index";
import { appendNavigationOrigin, parseNavigationOrigin } from "./navigation-origin";
import { parsePersonalJourneyUrlContext } from "./personalization/path-context";
import type { PublishedAlbumSummary } from "./schema";

export interface ArtistCollectionNavigationAuthority {
  readonly returnOrigin: ReturnType<typeof parseNavigationOrigin>["kind"];
  readonly discoveryEntry: ReturnType<typeof parseDiscoveryPathContext>["entryKind"] | null;
  readonly discoveryActive: boolean;
  readonly relationFamilies: readonly string[];
  readonly personalSource: ReturnType<typeof parsePersonalJourneyUrlContext>["source"];
}

export function buildArtistCollectionAlbumHref({
  targetSlug,
  searchParams = "",
  catalog,
}: {
  targetSlug: string;
  searchParams?: string | URLSearchParams;
  catalog: readonly PublishedAlbumSummary[];
}) {
  if (!catalog.some((album) => album.slug === targetSlug)) return null;
  const input = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
  const params = new URLSearchParams(serializeDiscoveryPathContext(parseDiscoveryPathContext(input, publishedDiscoveryIndex)));
  const personal = parsePersonalJourneyUrlContext(input, catalog);
  if (personal.source) params.set("pfrom", personal.source);
  if (personal.trailAlbumSlugs.length) params.set("ptrail", personal.trailAlbumSlugs.join("~"));
  const base = `/albums/${targetSlug}${params.size ? `?${params}` : ""}`;
  return appendNavigationOrigin(base, parseNavigationOrigin(input));
}

export function inspectArtistCollectionNavigationAuthority(
  searchParams: string | URLSearchParams,
  catalog: readonly PublishedAlbumSummary[],
): ArtistCollectionNavigationAuthority {
  const returnOrigin = parseNavigationOrigin(searchParams);
  const discovery = parseDiscoveryPathContext(searchParams, publishedDiscoveryIndex);
  const personal = parsePersonalJourneyUrlContext(searchParams, catalog);
  return Object.freeze({
    returnOrigin: returnOrigin.kind,
    discoveryEntry: discovery.entryKind ?? null,
    discoveryActive: Boolean(discovery.entryKind || discovery.trailAlbumSlugs.length || discovery.transitionFamilies.length),
    relationFamilies: Object.freeze([...discovery.transitionFamilies]),
    personalSource: personal.source,
  });
}
