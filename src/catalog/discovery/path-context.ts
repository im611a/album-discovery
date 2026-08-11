import type { DiscoveryIndex, DiscoveryNode } from "./types";

export const DISCOVERY_ENTRY_KINDS = [
  "album",
  "artist",
  "primary-genre",
  "secondary-genre",
  "era",
  "listening-context",
  "explore",
  "search",
  "discover",
] as const;

export type DiscoveryEntryKind = (typeof DISCOVERY_ENTRY_KINDS)[number];

export const DISCOVERY_TRANSITION_FAMILIES = [
  "SHARED_SECONDARY",
  "CLEAN_CHRONOLOGY",
  "SHARED_ARTIST",
  "PRIMARY_ADJACENT_ERA",
  "PRIMARY_DIFFERENT_ERA",
  "PRIMARY_SAME_ERA_CONTEXT",
  "PRIMARY_SAME_ERA",
  "PRIMARY_ONLY",
  "CONTEXT_ADJACENT_ERA",
  "CONTEXT_SAME_ERA",
  "CONTEXT_GENRE_BRIDGE",
  "ERA_ADJACENT",
  "ERA_SAME",
] as const;

export type DiscoveryTransitionFamily = (typeof DISCOVERY_TRANSITION_FAMILIES)[number];

export interface DiscoveryPathContext {
  readonly entryKind?: DiscoveryEntryKind;
  readonly entryKey?: string;
  readonly trailAlbumSlugs: readonly string[];
  readonly transitionFamilies: readonly DiscoveryTransitionFamily[];
}

const MAX_TRAIL_LENGTH = 3;
const MAX_RAW_VALUE_LENGTH = 512;

export const EMPTY_DISCOVERY_PATH_CONTEXT: DiscoveryPathContext = Object.freeze({
  trailAlbumSlugs: Object.freeze([]),
  transitionFamilies: Object.freeze([]),
});

function uniqueNewest(values: readonly string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (seen.has(value)) continue;
    seen.add(value);
    result.unshift(value);
  }
  return result.slice(-MAX_TRAIL_LENGTH);
}

function boundedTokens(value: string | null) {
  if (!value || value.length > MAX_RAW_VALUE_LENGTH) return [];
  return value.split("~").slice(-MAX_TRAIL_LENGTH).filter(Boolean);
}

function isEntryKind(value: string | null): value is DiscoveryEntryKind {
  return value != null && DISCOVERY_ENTRY_KINDS.includes(value as DiscoveryEntryKind);
}

function isTransitionFamily(value: string): value is DiscoveryTransitionFamily {
  return DISCOVERY_TRANSITION_FAMILIES.includes(value as DiscoveryTransitionFamily);
}

function entryKeyMatchesNode(kind: DiscoveryEntryKind, key: string, node: DiscoveryNode) {
  if (kind === "album") return node.type === "ALBUM" && (node.slug === key || node.canonicalId === key);
  if (kind === "artist") return node.type === "ARTIST" && (node.slug === key || node.canonicalId === key);
  if (kind === "primary-genre") return node.type === "PRIMARY_GENRE" && node.canonicalId === key;
  if (kind === "secondary-genre") return node.type === "SECONDARY_GENRE" && node.canonicalId === key;
  if (kind === "era") return node.type === "ERA" && node.canonicalId === key;
  if (kind === "listening-context") return node.type === "LISTENING_CONTEXT" && node.canonicalId === key;
  return false;
}

function validatedEntry(index: DiscoveryIndex, kind: DiscoveryEntryKind | undefined, key: string | null) {
  if (!kind) return {};
  if (kind === "explore" || kind === "search" || kind === "discover") {
    return { entryKind: kind } as const;
  }
  if (!key || key.length > MAX_RAW_VALUE_LENGTH) return {};
  return index.nodes.some((node) => entryKeyMatchesNode(kind, key, node))
    ? { entryKind: kind, entryKey: key } as const
    : {};
}

export function parseDiscoveryPathContext(
  input: string | URLSearchParams,
  index: DiscoveryIndex,
): DiscoveryPathContext {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const albumSlugs = new Set(index.nodes
    .filter((node): node is Extract<DiscoveryNode, { type: "ALBUM" }> => node.type === "ALBUM")
    .map((node) => node.slug));
  const trailAlbumSlugs = uniqueNewest(
    boundedTokens(params.get("trail")).filter((slug) => albumSlugs.has(slug)),
  );
  const transitionFamilies = boundedTokens(params.get("via"))
    .filter(isTransitionFamily);
  const kindValue = params.get("entry");
  const entry = validatedEntry(index, isEntryKind(kindValue) ? kindValue : undefined, params.get("entryKey"));
  return Object.freeze({
    ...entry,
    trailAlbumSlugs: Object.freeze(trailAlbumSlugs),
    transitionFamilies: Object.freeze(transitionFamilies),
  });
}

export function serializeDiscoveryPathContext(context: DiscoveryPathContext) {
  const params = new URLSearchParams();
  if (context.entryKind) params.set("entry", context.entryKind);
  if (context.entryKind && context.entryKey) params.set("entryKey", context.entryKey);
  if (context.trailAlbumSlugs.length) params.set("trail", context.trailAlbumSlugs.slice(-MAX_TRAIL_LENGTH).join("~"));
  if (context.transitionFamilies.length) params.set("via", context.transitionFamilies.slice(-MAX_TRAIL_LENGTH).join("~"));
  return params.toString();
}

export function appendDiscoveryPathContext(
  context: DiscoveryPathContext,
  currentAlbumSlug: string,
  transitionFamily: DiscoveryTransitionFamily,
): DiscoveryPathContext {
  return Object.freeze({
    ...(context.entryKind ? { entryKind: context.entryKind } : {}),
    ...(context.entryKey ? { entryKey: context.entryKey } : {}),
    trailAlbumSlugs: Object.freeze(uniqueNewest([...context.trailAlbumSlugs, currentAlbumSlug])),
    transitionFamilies: Object.freeze(
      [...context.transitionFamilies, transitionFamily].slice(-MAX_TRAIL_LENGTH),
    ),
  });
}

export function appendDiscoveryEntityPathContext(
  context: DiscoveryPathContext,
  currentAlbumSlug: string,
): DiscoveryPathContext {
  return Object.freeze({
    ...(context.entryKind
      ? { entryKind: context.entryKind, ...(context.entryKey ? { entryKey: context.entryKey } : {}) }
      : { entryKind: "album" as const, entryKey: currentAlbumSlug }),
    trailAlbumSlugs: Object.freeze(uniqueNewest([...context.trailAlbumSlugs, currentAlbumSlug])),
    transitionFamilies: Object.freeze(context.transitionFamilies.slice(-MAX_TRAIL_LENGTH)),
  });
}
