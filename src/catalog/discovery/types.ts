export const DISCOVERY_NODE_TYPES = [
  "ALBUM",
  "ARTIST",
  "PRIMARY_GENRE",
  "SECONDARY_GENRE",
  "ERA",
  "LISTENING_CONTEXT",
] as const;

export type DiscoveryNodeType = (typeof DISCOVERY_NODE_TYPES)[number];

export const DISCOVERY_MEMBERSHIP_TYPES = [
  "ALBUM_ARTIST",
  "ALBUM_PRIMARY_GENRE",
  "ALBUM_SECONDARY_GENRE",
  "ALBUM_ERA",
  "ALBUM_LISTENING_CONTEXT",
] as const;

export type DiscoveryMembershipType = (typeof DISCOVERY_MEMBERSHIP_TYPES)[number];

export const DISCOVERY_RELATION_TYPES = [
  "SAME_ARTIST",
  "SAME_PRIMARY_GENRE",
  "SHARED_SECONDARY_GENRE",
  "SAME_ERA",
  "ADJACENT_ERA",
  "CHRONOLOGICAL_NEIGHBOR",
  "SHARED_LISTENING_CONTEXT",
] as const;

export type DiscoveryRelationType = (typeof DISCOVERY_RELATION_TYPES)[number];

interface DiscoveryNodeBase {
  readonly nodeId: string;
  readonly canonicalId: string;
}

export interface DiscoveryAlbumNode extends DiscoveryNodeBase {
  readonly type: "ALBUM";
  readonly slug: string;
}

export interface DiscoveryArtistNode extends DiscoveryNodeBase {
  readonly type: "ARTIST";
  readonly slug: string;
}

export interface DiscoveryPrimaryGenreNode extends DiscoveryNodeBase {
  readonly type: "PRIMARY_GENRE";
}

export interface DiscoverySecondaryGenreNode extends DiscoveryNodeBase {
  readonly type: "SECONDARY_GENRE";
}

export interface DiscoveryEraNode extends DiscoveryNodeBase {
  readonly type: "ERA";
}

export interface DiscoveryListeningContextNode extends DiscoveryNodeBase {
  readonly type: "LISTENING_CONTEXT";
}

export type DiscoveryNode =
  | DiscoveryAlbumNode
  | DiscoveryArtistNode
  | DiscoveryPrimaryGenreNode
  | DiscoverySecondaryGenreNode
  | DiscoveryEraNode
  | DiscoveryListeningContextNode;

export interface DiscoveryMembershipEdge {
  readonly edgeId: string;
  readonly type: DiscoveryMembershipType;
  readonly albumId: string;
  readonly albumNodeId: string;
  readonly targetNodeId: string;
  readonly value: string;
}

export interface DiscoveryAlbumFacts {
  readonly albumId: string;
  readonly slug: string;
  readonly releaseDate: string | null;
  readonly releaseYear: number | null;
  readonly era: string | null;
  readonly artistIds: readonly string[];
  readonly primaryGenres: readonly string[];
  readonly secondaryGenres: readonly string[];
  readonly listeningContexts: readonly string[];
}

export interface DiscoveryChronologyEntry {
  readonly albumId: string;
  readonly releaseDate: string | null;
  readonly releaseYear: number | null;
}

export type ChronologyOrderingBasis =
  | "RELEASE_DATE"
  | "CANONICAL_ID_TIE_BREAK"
  | "UNKNOWN_DATE_AFTER_KNOWN"
  | "UNKNOWN_DATE_CANONICAL_ID_TIE_BREAK";

export interface SameArtistRelationEvidence {
  readonly type: "SAME_ARTIST";
  readonly artistIds: readonly string[];
  readonly sourceCreditCount: number;
  readonly targetCreditCount: number;
}

export interface SamePrimaryGenreRelationEvidence {
  readonly type: "SAME_PRIMARY_GENRE";
  readonly primaryGenres: readonly string[];
}

export interface SharedSecondaryGenreRelationEvidence {
  readonly type: "SHARED_SECONDARY_GENRE";
  readonly secondaryGenres: readonly string[];
}

export interface SameEraRelationEvidence {
  readonly type: "SAME_ERA";
  readonly era: string;
  readonly sourceYear: number;
  readonly targetYear: number;
}

export interface AdjacentEraRelationEvidence {
  readonly type: "ADJACENT_ERA";
  readonly sourceEra: string;
  readonly targetEra: string;
  readonly sourceYear: number;
  readonly targetYear: number;
  readonly decadeDistance: 10;
}

export interface ChronologicalNeighborSupport {
  readonly artistId: string;
  readonly direction: "PREVIOUS" | "NEXT";
  readonly sourceReleaseDate: string | null;
  readonly targetReleaseDate: string | null;
  readonly sourceYear: number | null;
  readonly targetYear: number | null;
  readonly orderingBasis: ChronologyOrderingBasis;
}

export interface ChronologicalNeighborRelationEvidence {
  readonly type: "CHRONOLOGICAL_NEIGHBOR";
  readonly neighbors: readonly ChronologicalNeighborSupport[];
}

export interface SharedListeningContextRelationEvidence {
  readonly type: "SHARED_LISTENING_CONTEXT";
  readonly listeningContexts: readonly string[];
}

export type DiscoveryRelationEvidence =
  | SameArtistRelationEvidence
  | SamePrimaryGenreRelationEvidence
  | SharedSecondaryGenreRelationEvidence
  | SameEraRelationEvidence
  | AdjacentEraRelationEvidence
  | ChronologicalNeighborRelationEvidence
  | SharedListeningContextRelationEvidence;

export interface AlbumRelationEvidence {
  readonly sourceAlbumId: string;
  readonly targetAlbumId: string;
  readonly relations: readonly DiscoveryRelationEvidence[];
}

export interface DiscoveryIndexValidation {
  readonly duplicateNodeIds: readonly string[];
  readonly duplicateMembershipEdgeIds: readonly string[];
  readonly unresolvedNodeReferences: readonly string[];
  readonly orphanNodeIds: readonly string[];
}

export interface DiscoveryIndexStats {
  readonly entityCount: number;
  readonly membershipEdgeCount: number;
  readonly nodeCountByType: Readonly<Record<DiscoveryNodeType, number>>;
  readonly membershipCountByType: Readonly<Record<DiscoveryMembershipType, number>>;
}

export interface DiscoveryIndex {
  readonly version: 1;
  readonly nodes: readonly DiscoveryNode[];
  readonly memberships: readonly DiscoveryMembershipEdge[];
  readonly albumFactsById: ReadonlyMap<string, DiscoveryAlbumFacts>;
  readonly nodeById: ReadonlyMap<string, DiscoveryNode>;
  readonly albumIdsByArtistId: ReadonlyMap<string, readonly string[]>;
  readonly albumIdsByPrimaryGenre: ReadonlyMap<string, readonly string[]>;
  readonly albumIdsBySecondaryGenre: ReadonlyMap<string, readonly string[]>;
  readonly albumIdsByEra: ReadonlyMap<string, readonly string[]>;
  readonly albumIdsByListeningContext: ReadonlyMap<string, readonly string[]>;
  readonly chronologyByArtistId: ReadonlyMap<string, readonly DiscoveryChronologyEntry[]>;
  readonly stats: DiscoveryIndexStats;
  readonly validation: DiscoveryIndexValidation;
}

export interface DiscoveryIndexSnapshot {
  readonly version: 1;
  readonly nodes: readonly DiscoveryNode[];
  readonly memberships: readonly DiscoveryMembershipEdge[];
  readonly chronologyByArtistId: readonly (readonly [string, readonly DiscoveryChronologyEntry[]])[];
  readonly stats: DiscoveryIndexStats;
  readonly validation: DiscoveryIndexValidation;
}
