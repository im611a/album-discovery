import type { PublishedAlbumSummary, PublishedArtistIndex } from "../schema";
import {
  DISCOVERY_MEMBERSHIP_TYPES,
  DISCOVERY_NODE_TYPES,
  type AlbumRelationEvidence,
  type ChronologicalNeighborSupport,
  type ChronologyOrderingBasis,
  type DiscoveryAlbumFacts,
  type DiscoveryChronologyEntry,
  type DiscoveryIndex,
  type DiscoveryIndexSnapshot,
  type DiscoveryIndexStats,
  type DiscoveryIndexValidation,
  type DiscoveryMembershipEdge,
  type DiscoveryMembershipType,
  type DiscoveryNode,
  type DiscoveryNodeType,
  type DiscoveryRelationEvidence,
} from "./types";

export class DiscoveryIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryIndexError";
  }
}

export function compareCanonicalValues(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function discoveryNodeId(type: DiscoveryNodeType, canonicalId: string) {
  if (!canonicalId.trim()) throw new DiscoveryIndexError(`${type} discovery identity cannot be empty.`);
  return `${type}:${canonicalId}`;
}

export function releaseYearToEra(releaseYear: number | null) {
  if (releaseYear == null) return null;
  if (!Number.isInteger(releaseYear) || releaseYear < 0) {
    throw new DiscoveryIndexError(`Invalid release year: ${releaseYear}`);
  }
  return `${Math.floor(releaseYear / 10) * 10}s`;
}

function eraStart(era: string) {
  if (!/^\d{3}0s$/.test(era)) return null;
  return Number.parseInt(era.slice(0, -1), 10);
}

export function areAdjacentEras(left: string | null, right: string | null) {
  if (left == null || right == null) return false;
  const leftStart = eraStart(left);
  const rightStart = eraStart(right);
  return leftStart != null && rightStart != null && Math.abs(leftStart - rightStart) === 10;
}

export function compareDiscoveryChronology(
  left: DiscoveryChronologyEntry,
  right: DiscoveryChronologyEntry,
) {
  if (left.releaseYear == null && right.releaseYear != null) return 1;
  if (left.releaseYear != null && right.releaseYear == null) return -1;
  if (left.releaseYear != null && right.releaseYear != null && left.releaseYear !== right.releaseYear) {
    return left.releaseYear - right.releaseYear;
  }
  if (left.releaseDate == null && right.releaseDate != null) return 1;
  if (left.releaseDate != null && right.releaseDate == null) return -1;
  if (left.releaseDate != null && right.releaseDate != null) {
    const dateOrder = compareCanonicalValues(left.releaseDate, right.releaseDate);
    if (dateOrder) return dateOrder;
  }
  return compareCanonicalValues(left.albumId, right.albumId);
}

function chronologyOrderingBasis(
  source: DiscoveryChronologyEntry,
  target: DiscoveryChronologyEntry,
): ChronologyOrderingBasis {
  if (source.releaseYear == null && target.releaseYear == null) {
    return "UNKNOWN_DATE_CANONICAL_ID_TIE_BREAK";
  }
  if (source.releaseYear == null || target.releaseYear == null) {
    return "UNKNOWN_DATE_AFTER_KNOWN";
  }
  if (
    source.releaseYear !== target.releaseYear ||
    source.releaseDate !== target.releaseDate
  ) {
    return "RELEASE_DATE";
  }
  return "CANONICAL_ID_TIE_BREAK";
}

function uniqueSorted(values: readonly string[]) {
  for (const value of values) {
    if (!value.trim()) throw new DiscoveryIndexError("Discovery membership value cannot be empty.");
  }
  return Object.freeze([...new Set(values)].sort(compareCanonicalValues));
}

function assertUnique(values: readonly string[], label: string) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (!value.trim()) throw new DiscoveryIndexError(`${label} cannot be empty.`);
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  if (duplicates.size) {
    throw new DiscoveryIndexError(
      `Duplicate ${label}: ${[...duplicates].sort(compareCanonicalValues).join(", ")}`,
    );
  }
}

function validateReleaseFields(album: PublishedAlbumSummary) {
  if (album.releaseDate == null && album.releaseYear == null) return;
  if (album.releaseDate == null || album.releaseYear == null) {
    throw new DiscoveryIndexError(`Album ${album.id} has inconsistent release date/year fields.`);
  }
  const dateYear = Number.parseInt(album.releaseDate.slice(0, 4), 10);
  if (!Number.isInteger(album.releaseYear) || dateYear !== album.releaseYear) {
    throw new DiscoveryIndexError(`Album ${album.id} has inconsistent release chronology.`);
  }
}

function freezeLookup(source: Map<string, string[]>) {
  return new Map(
    [...source.entries()]
      .sort(([left], [right]) => compareCanonicalValues(left, right))
      .map(([key, values]) => [key, uniqueSorted(values)] as const),
  ) as ReadonlyMap<string, readonly string[]>;
}

function pushLookup(map: Map<string, string[]>, key: string, albumId: string) {
  const values = map.get(key);
  if (values) values.push(albumId);
  else map.set(key, [albumId]);
}

function countByType<T extends string>(types: readonly T[], values: readonly { type: T }[]) {
  return Object.freeze(Object.fromEntries(types.map((type) => [
    type,
    values.filter((value) => value.type === type).length,
  ]))) as Readonly<Record<T, number>>;
}

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return Object.freeze([...duplicates].sort(compareCanonicalValues));
}

export function buildDiscoveryIndex(
  albums: readonly PublishedAlbumSummary[],
  artists: readonly PublishedArtistIndex[],
): DiscoveryIndex {
  assertUnique(albums.map((album) => album.id), "album ID");
  assertUnique(albums.map((album) => album.slug), "album slug");
  assertUnique(artists.map((artist) => artist.artistId), "artist ID");
  assertUnique(artists.map((artist) => artist.slug), "artist slug");

  const sortedAlbums = [...albums].sort((left, right) => compareCanonicalValues(left.id, right.id));
  const sortedArtists = [...artists].sort((left, right) => compareCanonicalValues(left.artistId, right.artistId));
  const albumById = new Map(sortedAlbums.map((album) => [album.id, album] as const));
  const artistById = new Map(sortedArtists.map((artist) => [artist.artistId, artist] as const));

  const unresolvedSourceReferences: string[] = [];
  for (const album of sortedAlbums) {
    validateReleaseFields(album);
    for (const artistId of uniqueSorted(album.artists.map((artist) => artist.id))) {
      if (!artistById.has(artistId)) unresolvedSourceReferences.push(`${album.id}->${artistId}`);
    }
  }
  for (const artist of sortedArtists) {
    for (const albumId of uniqueSorted(artist.albumIds)) {
      const album = albumById.get(albumId);
      if (!album) unresolvedSourceReferences.push(`${artist.artistId}->${albumId}`);
      else if (!album.artists.some((credit) => credit.id === artist.artistId)) {
        unresolvedSourceReferences.push(`${artist.artistId}!${albumId}`);
      }
    }
  }
  for (const album of sortedAlbums) {
    for (const artistId of uniqueSorted(album.artists.map((artist) => artist.id))) {
      if (!artistById.get(artistId)?.albumIds.includes(album.id)) {
        unresolvedSourceReferences.push(`${album.id}!${artistId}`);
      }
    }
  }
  if (unresolvedSourceReferences.length) {
    throw new DiscoveryIndexError(
      `Unresolved discovery source references: ${uniqueSorted(unresolvedSourceReferences).join(", ")}`,
    );
  }

  const primaryGenres = uniqueSorted(sortedAlbums.flatMap((album) => album.coreGenres));
  const secondaryGenres = uniqueSorted(sortedAlbums.flatMap((album) => album.relatedGenres));
  const eras = uniqueSorted(sortedAlbums.map((album) => releaseYearToEra(album.releaseYear)).filter((value): value is string => value != null));
  const listeningContexts = uniqueSorted(sortedAlbums.flatMap((album) => album.contexts));

  const nodes: DiscoveryNode[] = [
    ...sortedAlbums.map((album) => ({
      type: "ALBUM" as const,
      nodeId: discoveryNodeId("ALBUM", album.id),
      canonicalId: album.id,
      slug: album.slug,
    })),
    ...sortedArtists.map((artist) => ({
      type: "ARTIST" as const,
      nodeId: discoveryNodeId("ARTIST", artist.artistId),
      canonicalId: artist.artistId,
      slug: artist.slug,
    })),
    ...primaryGenres.map((canonicalId) => ({
      type: "PRIMARY_GENRE" as const,
      nodeId: discoveryNodeId("PRIMARY_GENRE", canonicalId),
      canonicalId,
    })),
    ...secondaryGenres.map((canonicalId) => ({
      type: "SECONDARY_GENRE" as const,
      nodeId: discoveryNodeId("SECONDARY_GENRE", canonicalId),
      canonicalId,
    })),
    ...eras.map((canonicalId) => ({
      type: "ERA" as const,
      nodeId: discoveryNodeId("ERA", canonicalId),
      canonicalId,
    })),
    ...listeningContexts.map((canonicalId) => ({
      type: "LISTENING_CONTEXT" as const,
      nodeId: discoveryNodeId("LISTENING_CONTEXT", canonicalId),
      canonicalId,
    })),
  ];

  const nodeOrder = new Map(DISCOVERY_NODE_TYPES.map((type, index) => [type, index] as const));
  nodes.sort((left, right) =>
    (nodeOrder.get(left.type) ?? 0) - (nodeOrder.get(right.type) ?? 0) ||
    compareCanonicalValues(left.canonicalId, right.canonicalId));
  const frozenNodes = Object.freeze(nodes.map((node) => Object.freeze(node)));
  const nodeById = new Map(frozenNodes.map((node) => [node.nodeId, node] as const));

  const albumFactsById = new Map<string, DiscoveryAlbumFacts>();
  const membershipById = new Map<string, DiscoveryMembershipEdge>();
  const addMembership = (
    albumId: string,
    type: DiscoveryMembershipType,
    targetType: DiscoveryNodeType,
    value: string,
  ) => {
    const albumNodeId = discoveryNodeId("ALBUM", albumId);
    const targetNodeId = discoveryNodeId(targetType, value);
    const edgeId = `${type}:${albumId}->${targetNodeId}`;
    membershipById.set(edgeId, Object.freeze({ edgeId, type, albumId, albumNodeId, targetNodeId, value }));
  };

  for (const album of sortedAlbums) {
    const artistIds = uniqueSorted(album.artists.map((artist) => artist.id));
    const albumPrimaryGenres = uniqueSorted(album.coreGenres);
    const albumSecondaryGenres = uniqueSorted(album.relatedGenres);
    const albumContexts = uniqueSorted(album.contexts);
    const era = releaseYearToEra(album.releaseYear);
    const facts: DiscoveryAlbumFacts = Object.freeze({
      albumId: album.id,
      slug: album.slug,
      releaseDate: album.releaseDate,
      releaseYear: album.releaseYear,
      era,
      artistIds,
      primaryGenres: albumPrimaryGenres,
      secondaryGenres: albumSecondaryGenres,
      listeningContexts: albumContexts,
    });
    albumFactsById.set(album.id, facts);
    for (const artistId of artistIds) addMembership(album.id, "ALBUM_ARTIST", "ARTIST", artistId);
    for (const genre of albumPrimaryGenres) addMembership(album.id, "ALBUM_PRIMARY_GENRE", "PRIMARY_GENRE", genre);
    for (const genre of albumSecondaryGenres) addMembership(album.id, "ALBUM_SECONDARY_GENRE", "SECONDARY_GENRE", genre);
    if (era) addMembership(album.id, "ALBUM_ERA", "ERA", era);
    for (const context of albumContexts) addMembership(album.id, "ALBUM_LISTENING_CONTEXT", "LISTENING_CONTEXT", context);
  }

  const membershipOrder = new Map(DISCOVERY_MEMBERSHIP_TYPES.map((type, index) => [type, index] as const));
  const memberships = Object.freeze([...membershipById.values()].sort((left, right) =>
    (membershipOrder.get(left.type) ?? 0) - (membershipOrder.get(right.type) ?? 0) ||
    compareCanonicalValues(left.albumId, right.albumId) ||
    compareCanonicalValues(left.targetNodeId, right.targetNodeId)));

  const artistLookup = new Map<string, string[]>();
  const primaryGenreLookup = new Map<string, string[]>();
  const secondaryGenreLookup = new Map<string, string[]>();
  const eraLookup = new Map<string, string[]>();
  const contextLookup = new Map<string, string[]>();
  for (const facts of albumFactsById.values()) {
    for (const artistId of facts.artistIds) pushLookup(artistLookup, artistId, facts.albumId);
    for (const genre of facts.primaryGenres) pushLookup(primaryGenreLookup, genre, facts.albumId);
    for (const genre of facts.secondaryGenres) pushLookup(secondaryGenreLookup, genre, facts.albumId);
    if (facts.era) pushLookup(eraLookup, facts.era, facts.albumId);
    for (const context of facts.listeningContexts) pushLookup(contextLookup, context, facts.albumId);
  }

  const albumIdsByArtistId = freezeLookup(artistLookup);
  const albumIdsByPrimaryGenre = freezeLookup(primaryGenreLookup);
  const albumIdsBySecondaryGenre = freezeLookup(secondaryGenreLookup);
  const albumIdsByEra = freezeLookup(eraLookup);
  const albumIdsByListeningContext = freezeLookup(contextLookup);
  const chronologyByArtistId = new Map<string, readonly DiscoveryChronologyEntry[]>(
    [...albumIdsByArtistId.entries()].map(([artistId, albumIds]) => [
      artistId,
      Object.freeze(albumIds.map((albumId) => {
        const facts = albumFactsById.get(albumId);
        if (!facts) throw new DiscoveryIndexError(`Missing album facts for ${albumId}.`);
        return Object.freeze({
          albumId,
          releaseDate: facts.releaseDate,
          releaseYear: facts.releaseYear,
        });
      }).sort(compareDiscoveryChronology)),
    ]),
  );

  const duplicateNodeIds = duplicateValues(frozenNodes.map((node) => node.nodeId));
  const duplicateMembershipEdgeIds = duplicateValues(memberships.map((edge) => edge.edgeId));
  const unresolvedNodeReferences = Object.freeze(memberships.flatMap((edge) => [
    nodeById.has(edge.albumNodeId) ? null : edge.albumNodeId,
    nodeById.has(edge.targetNodeId) ? null : edge.targetNodeId,
  ]).filter((value): value is string => value != null).sort(compareCanonicalValues));
  const referencedNodeIds = new Set(memberships.flatMap((edge) => [edge.albumNodeId, edge.targetNodeId]));
  const orphanNodeIds = Object.freeze(frozenNodes
    .filter((node) => !referencedNodeIds.has(node.nodeId))
    .map((node) => node.nodeId));
  const validation: DiscoveryIndexValidation = Object.freeze({
    duplicateNodeIds,
    duplicateMembershipEdgeIds,
    unresolvedNodeReferences,
    orphanNodeIds,
  });
  if (duplicateNodeIds.length || duplicateMembershipEdgeIds.length || unresolvedNodeReferences.length) {
    throw new DiscoveryIndexError("Generated discovery index failed semantic validation.");
  }

  const stats: DiscoveryIndexStats = Object.freeze({
    entityCount: frozenNodes.length,
    membershipEdgeCount: memberships.length,
    nodeCountByType: countByType(DISCOVERY_NODE_TYPES, frozenNodes),
    membershipCountByType: countByType(DISCOVERY_MEMBERSHIP_TYPES, memberships),
  });

  return Object.freeze({
    version: 1 as const,
    nodes: frozenNodes,
    memberships,
    albumFactsById,
    nodeById,
    albumIdsByArtistId,
    albumIdsByPrimaryGenre,
    albumIdsBySecondaryGenre,
    albumIdsByEra,
    albumIdsByListeningContext,
    chronologyByArtistId,
    stats,
    validation,
  });
}

function intersection(left: readonly string[], right: readonly string[]) {
  const rightSet = new Set(right);
  return Object.freeze(left.filter((value) => rightSet.has(value)).sort(compareCanonicalValues));
}

function chronologicalNeighborEvidence(
  index: DiscoveryIndex,
  source: DiscoveryAlbumFacts,
  target: DiscoveryAlbumFacts,
  sharedArtistIds: readonly string[],
) {
  const neighbors: ChronologicalNeighborSupport[] = [];
  for (const artistId of sharedArtistIds) {
    const chronology = index.chronologyByArtistId.get(artistId);
    if (!chronology) continue;
    const sourceIndex = chronology.findIndex((entry) => entry.albumId === source.albumId);
    const targetIndex = chronology.findIndex((entry) => entry.albumId === target.albumId);
    if (sourceIndex < 0 || targetIndex < 0 || Math.abs(sourceIndex - targetIndex) !== 1) continue;
    const sourceEntry = chronology[sourceIndex];
    const targetEntry = chronology[targetIndex];
    neighbors.push(Object.freeze({
      artistId,
      direction: targetIndex < sourceIndex ? "PREVIOUS" : "NEXT",
      sourceReleaseDate: sourceEntry.releaseDate,
      targetReleaseDate: targetEntry.releaseDate,
      sourceYear: sourceEntry.releaseYear,
      targetYear: targetEntry.releaseYear,
      orderingBasis: chronologyOrderingBasis(sourceEntry, targetEntry),
    }));
  }
  return Object.freeze(neighbors.sort((left, right) => compareCanonicalValues(left.artistId, right.artistId)));
}

export function getAlbumRelationEvidence(
  index: DiscoveryIndex,
  sourceAlbumId: string,
  targetAlbumId: string,
): AlbumRelationEvidence | null {
  if (sourceAlbumId === targetAlbumId) return null;
  const source = index.albumFactsById.get(sourceAlbumId);
  const target = index.albumFactsById.get(targetAlbumId);
  if (!source || !target) return null;

  const relations: DiscoveryRelationEvidence[] = [];
  const sharedArtistIds = intersection(source.artistIds, target.artistIds);
  if (sharedArtistIds.length) {
    relations.push(Object.freeze({
      type: "SAME_ARTIST",
      artistIds: sharedArtistIds,
      sourceCreditCount: source.artistIds.length,
      targetCreditCount: target.artistIds.length,
    }));
  }
  const sharedPrimaryGenres = intersection(source.primaryGenres, target.primaryGenres);
  if (sharedPrimaryGenres.length) {
    relations.push(Object.freeze({ type: "SAME_PRIMARY_GENRE", primaryGenres: sharedPrimaryGenres }));
  }
  const sharedSecondaryGenres = intersection(source.secondaryGenres, target.secondaryGenres);
  if (sharedSecondaryGenres.length) {
    relations.push(Object.freeze({ type: "SHARED_SECONDARY_GENRE", secondaryGenres: sharedSecondaryGenres }));
  }
  if (source.era != null && target.era != null && source.era === target.era && source.releaseYear != null && target.releaseYear != null) {
    relations.push(Object.freeze({
      type: "SAME_ERA",
      era: source.era,
      sourceYear: source.releaseYear,
      targetYear: target.releaseYear,
    }));
  } else if (areAdjacentEras(source.era, target.era) && source.era != null && target.era != null && source.releaseYear != null && target.releaseYear != null) {
    relations.push(Object.freeze({
      type: "ADJACENT_ERA",
      sourceEra: source.era,
      targetEra: target.era,
      sourceYear: source.releaseYear,
      targetYear: target.releaseYear,
      decadeDistance: 10,
    }));
  }
  const neighborEvidence = chronologicalNeighborEvidence(index, source, target, sharedArtistIds);
  if (neighborEvidence.length) {
    relations.push(Object.freeze({ type: "CHRONOLOGICAL_NEIGHBOR", neighbors: neighborEvidence }));
  }
  const sharedContexts = intersection(source.listeningContexts, target.listeningContexts);
  if (sharedContexts.length) {
    relations.push(Object.freeze({ type: "SHARED_LISTENING_CONTEXT", listeningContexts: sharedContexts }));
  }
  if (!relations.length) return null;
  return Object.freeze({
    sourceAlbumId,
    targetAlbumId,
    relations: Object.freeze(relations),
  });
}

export function getDiscoveryIndexSnapshot(index: DiscoveryIndex): DiscoveryIndexSnapshot {
  return Object.freeze({
    version: 1 as const,
    nodes: index.nodes,
    memberships: index.memberships,
    chronologyByArtistId: Object.freeze([...index.chronologyByArtistId.entries()]
      .sort(([left], [right]) => compareCanonicalValues(left, right))
      .map(([artistId, chronology]) => Object.freeze([artistId, chronology] as const))),
    stats: index.stats,
    validation: index.validation,
  });
}

export function serializeDiscoveryIndex(index: DiscoveryIndex) {
  return JSON.stringify(getDiscoveryIndexSnapshot(index));
}
