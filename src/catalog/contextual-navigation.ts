import { buildDiscoveryEntityHref } from "./discovery/artist-topic-presentation";
import { appendNavigationOrigin } from "./navigation-origin";
import { appendPersonalJourneyUrlContext } from "./personalization/path-context";
import type { PublishedAlbumSummary } from "./schema";

export const MAX_CROSS_PRODUCT_CONTEXT_URL_LENGTH = 768;

/**
 * Composes the existing R13, R14 and R15 URL authorities at a route boundary.
 * Each authority remains independently parsed and bounded; canonical identity
 * is always the supplied pathname and never depends on provenance.
 */
export function buildCrossProductEntityHref({
  pathname,
  currentAlbumSlug,
  searchParams = "",
  catalog,
}: {
  pathname: string;
  currentAlbumSlug: string;
  searchParams?: string | URLSearchParams;
  catalog: readonly PublishedAlbumSummary[];
}) {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/";
  const discoveryHref = buildDiscoveryEntityHref(pathname, currentAlbumSlug, searchParams);
  const returnHref = appendNavigationOrigin(discoveryHref, searchParams);
  const composed = appendPersonalJourneyUrlContext({
    href: returnHref,
    searchParams,
    currentAlbumSlug,
    catalog,
  });
  return composed.length <= MAX_CROSS_PRODUCT_CONTEXT_URL_LENGTH ? composed : pathname;
}
