import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import type { PublishedAlbumSummary, PublishedArtistIndex } from "../schema";
import { publishedDiscoveryIndex } from "./published-index";
import {
  areAdjacentEras,
  buildDiscoveryIndex,
  compareDiscoveryChronology,
  DiscoveryIndexError,
  getAlbumRelationEvidence,
  releaseYearToEra,
  serializeDiscoveryIndex,
} from "./relation-index";

const albumBySlug = (slug: string) => {
  const album = catalogAlbums.find((candidate) => candidate.slug === slug);
  if (!album) throw new Error(`Missing catalog fixture: ${slug}`);
  return album;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R13 discovery relation/index foundation", () => {
  it("derives the projected real-catalog entity and membership counts", () => {
    expect(publishedDiscoveryIndex.stats).toEqual({
      entityCount: 696,
      membershipEdgeCount: 1_949,
      nodeCountByType: {
        ALBUM: 345,
        ARTIST: 298,
        PRIMARY_GENRE: 15,
        SECONDARY_GENRE: 24,
        ERA: 7,
        LISTENING_CONTEXT: 7,
      },
      membershipCountByType: {
        ALBUM_ARTIST: 615,
        ALBUM_PRIMARY_GENRE: 345,
        ALBUM_SECONDARY_GENRE: 28,
        ALBUM_ERA: 345,
        ALBUM_LISTENING_CONTEXT: 616,
      },
    });
  });

  it("has normalized unique identities, resolved references, and no orphan nodes", () => {
    const index = publishedDiscoveryIndex;
    expect(index.validation).toEqual({
      duplicateNodeIds: [],
      duplicateMembershipEdgeIds: [],
      unresolvedNodeReferences: [],
      orphanNodeIds: [],
    });
    expect(new Set(index.nodes.map((node) => node.nodeId)).size).toBe(index.nodes.length);
    expect(new Set(index.memberships.map((edge) => edge.edgeId)).size).toBe(index.memberships.length);
    for (const edge of index.memberships) {
      expect(index.nodeById.has(edge.albumNodeId)).toBe(true);
      expect(index.nodeById.has(edge.targetNodeId)).toBe(true);
    }
  });

  it("creates every canonical membership supported by each album", () => {
    for (const album of catalogAlbums) {
      const memberships = publishedDiscoveryIndex.memberships.filter((edge) => edge.albumId === album.id);
      const expectedCount = new Set(album.artists.map((artist) => artist.id)).size
        + new Set(album.coreGenres).size
        + new Set(album.relatedGenres).size
        + new Set(album.contexts).size
        + (album.releaseYear == null ? 0 : 1);
      expect(memberships).toHaveLength(expectedCount);
      expect(publishedDiscoveryIndex.nodeById.has(`ALBUM:${album.id}`)).toBe(true);
    }
  });

  it("is byte-deterministic across source ordering", () => {
    const reversed = buildDiscoveryIndex(
      [...catalogAlbums].reverse(),
      [...publishedArtists].reverse(),
    );
    expect(serializeDiscoveryIndex(reversed)).toBe(serializeDiscoveryIndex(publishedDiscoveryIndex));
  });

  it("deduplicates repeated source memberships without changing output", () => {
    const first = catalogAlbums[0];
    const albums: PublishedAlbumSummary[] = catalogAlbums.map((album) => album.id === first.id ? {
      ...album,
      artists: [...album.artists, ...album.artists],
      coreGenres: [...album.coreGenres, ...album.coreGenres],
      relatedGenres: [...album.relatedGenres, ...album.relatedGenres],
      contexts: [...album.contexts, ...album.contexts],
    } : album);
    expect(serializeDiscoveryIndex(buildDiscoveryIndex(albums, publishedArtists)))
      .toBe(serializeDiscoveryIndex(publishedDiscoveryIndex));
  });

  it("ignores metadata outside the approved relation foundation", () => {
    const albums: PublishedAlbumSummary[] = catalogAlbums.map((album) => ({
      ...album,
      internalId: `ignored:${album.internalId}`,
      neteaseAlbumId: `ignored:${album.neteaseAlbumId}`,
      title: `ignored:${album.title}`,
      aliases: ["ignored"],
      albumType: "album",
      thumbnailPath: null,
      discoveredAt: "1900-01-01T00:00:00.000Z",
      sourceMarketChannels: [],
      rymRating: null,
      rymRatingCount: null,
      editorial: null,
      searchText: "ignored",
    }));
    const artists: PublishedArtistIndex[] = publishedArtists.map((artist) => ({
      ...artist,
      neteaseArtistId: `ignored:${artist.neteaseArtistId}`,
      name: `ignored:${artist.name}`,
      aliases: ["ignored"],
      albumCount: 0,
      albumCountByType: {},
      earliestYear: null,
      latestYear: null,
      commonCoreGenres: [],
      previewCovers: [],
    }));
    expect(serializeDiscoveryIndex(buildDiscoveryIndex(albums, artists)))
      .toBe(serializeDiscoveryIndex(publishedDiscoveryIndex));
  });

  it("keeps primary and secondary genre identities semantically distinct", () => {
    const loveless = albumBySlug("loveless");
    expect(publishedDiscoveryIndex.nodeById.has("PRIMARY_GENRE:dream-pop")).toBe(true);
    expect(publishedDiscoveryIndex.nodeById.has("SECONDARY_GENRE:dream-pop")).toBe(true);
    const memberships = publishedDiscoveryIndex.memberships.filter((edge) => edge.albumId === loveless.id);
    expect(memberships).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "ALBUM_PRIMARY_GENRE", targetNodeId: "PRIMARY_GENRE:dream-pop" }),
      expect.objectContaining({ type: "ALBUM_SECONDARY_GENRE", targetNodeId: "SECONDARY_GENRE:dream-pop" }),
    ]));
  });

  it("preserves the actual values supporting secondary-genre and context relations", () => {
    const rumours = albumBySlug("rumours");
    const blue = albumBySlug("blue-joni-mitchell");
    const secondaryEvidence = getAlbumRelationEvidence(publishedDiscoveryIndex, rumours.id, blue.id);
    expect(secondaryEvidence?.relations).toContainEqual({
      type: "SHARED_SECONDARY_GENRE",
      secondaryGenres: ["folk-pop"],
    });

    const okComputer = albumBySlug("ok-computer");
    const loveless = albumBySlug("loveless");
    const contextEvidence = getAlbumRelationEvidence(publishedDiscoveryIndex, okComputer.id, loveless.id);
    expect(contextEvidence?.relations).toContainEqual({
      type: "SHARED_LISTENING_CONTEXT",
      listeningContexts: ["focus", "night"],
    });
  });

  it("emits same-artist and chronology-neighbor evidence from actual catalog facts", () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1);
    if (!artist) throw new Error("Expected a multi-album artist fixture.");
    const chronology = publishedDiscoveryIndex.chronologyByArtistId.get(artist.artistId);
    if (!chronology || chronology.length < 2) throw new Error("Expected a multi-album chronology.");
    const evidence = getAlbumRelationEvidence(
      publishedDiscoveryIndex,
      chronology[0].albumId,
      chronology[1].albumId,
    );
    expect(evidence?.relations).toContainEqual(expect.objectContaining({
      type: "SAME_ARTIST",
      artistIds: expect.arrayContaining([artist.artistId]),
    }));
    expect(evidence?.relations).toContainEqual(expect.objectContaining({
      type: "CHRONOLOGICAL_NEIGHBOR",
      neighbors: expect.arrayContaining([expect.objectContaining({ artistId: artist.artistId })]),
    }));
  });

  it("uses explicit deterministic chronology tie and unknown-date rules", () => {
    const datedA = { albumId: "album:a", releaseDate: "2000-01-01", releaseYear: 2000 } as const;
    const datedB = { albumId: "album:b", releaseDate: "2000-01-01", releaseYear: 2000 } as const;
    const unknown = { albumId: "album:unknown", releaseDate: null, releaseYear: null } as const;
    expect(compareDiscoveryChronology(datedA, datedB)).toBeLessThan(0);
    expect(compareDiscoveryChronology(unknown, datedB)).toBeGreaterThan(0);
  });

  it("derives same and adjacent eras without conflating them", () => {
    expect(releaseYearToEra(1999)).toBe("1990s");
    expect(areAdjacentEras("1990s", "2000s")).toBe(true);
    expect(areAdjacentEras("1990s", "1990s")).toBe(false);
    expect(areAdjacentEras("1990s", "2010s")).toBe(false);
    expect(areAdjacentEras(null, "2000s")).toBe(false);
  });

  it("never creates self-relations or evidence for unknown identities", () => {
    const albumId = catalogAlbums[0].id;
    expect(getAlbumRelationEvidence(publishedDiscoveryIndex, albumId, albumId)).toBeNull();
    expect(getAlbumRelationEvidence(publishedDiscoveryIndex, albumId, "album:missing")).toBeNull();
  });

  it("fails closed on duplicate identities and unresolved artist references", () => {
    expect(() => buildDiscoveryIndex([...catalogAlbums, catalogAlbums[0]], publishedArtists))
      .toThrow(DiscoveryIndexError);
    const albums: PublishedAlbumSummary[] = catalogAlbums.map((album, index) => index === 0 ? {
      ...album,
      artists: [{ ...album.artists[0], id: "artist:missing" }],
    } : album);
    expect(() => buildDiscoveryIndex(albums, publishedArtists)).toThrow(/Unresolved discovery source references/);
  });

  it("performs no runtime network access", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    buildDiscoveryIndex(catalogAlbums, publishedArtists);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
