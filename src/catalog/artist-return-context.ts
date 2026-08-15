import { publishedDiscoveryIndex } from "./discovery/published-index";

const MAX_ARTIST_RETURN_SLUG_LENGTH = 128;
const MAX_ARTIST_RETURN_URL_LENGTH = 768;

export function resolveArtistReturnHref(value: string | null | undefined) {
  if (!value || value.length > MAX_ARTIST_RETURN_SLUG_LENGTH) return null;
  const node = publishedDiscoveryIndex.nodes.find((candidate) =>
    candidate.type === "ARTIST" && (candidate.slug === value || candidate.canonicalId === value));
  return node?.type === "ARTIST" ? `/artists/${node.slug}` : null;
}

export function appendArtistReturnContext(href: string, artistSlug: string | undefined) {
  if (!resolveArtistReturnHref(artistSlug) || !href.startsWith("/") || href.startsWith("//")) return href;
  const [fragmentless, fragment = ""] = href.split("#", 2);
  const [pathname, query = ""] = fragmentless.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("afrom", "artist");
  params.set("aslug", artistSlug!);
  const result = `${pathname}?${params}${fragment ? `#${fragment}` : ""}`;
  return result.length <= MAX_ARTIST_RETURN_URL_LENGTH ? result : href;
}

export function parseArtistReturnContext(input: string | URLSearchParams) {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  return params.get("afrom") === "artist" ? resolveArtistReturnHref(params.get("aslug")) : null;
}
