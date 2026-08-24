import { describe, expect, it } from "vitest";

import { createInitialUserState } from "@/features/personal-state/schema";

import {
  auditArtistAlbumGraph,
  projectAllArtistCollections,
  projectArtistCollection,
} from "./artist-collection";
import { catalogAlbums, publishedArtists } from "./published-catalog";

const state = (overrides: Record<string, unknown> = {}) => ({ ...createInitialUserState(), ...overrides });

describe("R16 Artist↔Album canonical graph", () => {
  it("audits all 453 Artists, 1,330 Albums and 1,794 credited memberships without identity failures", () => {
    expect(auditArtistAlbumGraph(publishedArtists, catalogAlbums)).toEqual({
      artistCount: 453,
      albumCount: 1_330,
      singleWorkArtists: 297,
      multiWorkArtists: 156,
      artistAlbumMemberships: 1_794,
      invalidArtistReferences: 0,
      invalidAlbumReferences: 0,
      unresolvedAlbumReferences: 0,
      duplicateArtistNodes: 0,
      duplicateAlbumNodes: 0,
      duplicateArtistAlbumMemberships: 0,
      creditMismatches: 0,
    });
  });

  it("records only sole/shared credit facts and never fabricates primary or secondary artist roles", () => {
    const sharedAlbum = catalogAlbums.find((album) => album.artists.length > 1)!;
    const artist = publishedArtists.find((candidate) => candidate.artistId === sharedAlbum.artists[0]!.id)!;
    const entry = projectArtistCollection({ artist, catalog: catalogAlbums, state: null }).publishedAlbums.find((item) => item.albumId === sharedAlbum.id)!;
    expect(entry.credit).toEqual({ position: 0, count: sharedAlbum.artists.length, kind: "SHARED_CREDIT" });
    expect(JSON.stringify(entry.credit)).not.toMatch(/primary|secondary|main/i);
  });
});

describe("R16 canonical ArtistCollection projection", () => {
  const artist = [...publishedArtists].sort((a, b) => b.albumCount - a.albumCount)[0]!;
  const ids = artist.albumIds;

  it("derives finite subsets from LocalUserStateV1 while preserving chronology and catalog identity", () => {
    const projection = projectArtistCollection({
      artist,
      catalog: catalogAlbums,
      state: state({
        savedAlbumIds: ids.slice(0, 3),
        likedAlbumIds: ids.slice(1, 4),
        favoriteAlbumIds: ids.slice(2, 5),
        listenedAlbumIds: ids.slice(3, 6),
        recentAlbumIds: ids.slice(4, 7),
      }),
    });
    expect(projection.publishedAlbums).toHaveLength(artist.albumCount);
    expect(projection.publishedAlbums.every((entry) => entry.album.artists.some((credit) => credit.id === artist.artistId))).toBe(true);
    expect(projection.listenLaterAlbums.map((entry) => entry.albumId)).toEqual(expect.arrayContaining(ids.slice(0, 3)));
    expect(projection.summary).toMatchObject({ keptWorksCount: 6, recentlyViewedWorksCount: 3 });
    expect(projection.publishedAlbums.map((entry) => entry.chronologyPosition)).toEqual(Array.from({ length: artist.albumCount }, (_, index) => index));
  });

  it("uses deterministic visible precedence without erasing independent underlying flags", () => {
    const id = ids[0]!;
    const projection = projectArtistCollection({
      artist,
      catalog: catalogAlbums,
      state: state({ savedAlbumIds: [id], likedAlbumIds: [id], favoriteAlbumIds: [id], listenedAlbumIds: [id], recentAlbumIds: [id] }),
    });
    const entry = projection.publishedAlbums.find((item) => item.albumId === id)!;
    expect(entry.primaryStatus).toBe("FAVORITE");
    expect(entry.states).toMatchObject({ saved: true, liked: true, favorite: true, markedListened: true, recentlyViewed: true });
    expect(entry.membershipReasons).toEqual(["SAVED", "LIKED", "FAVORITE", "MARKED_LISTENED"]);
  });

  it("keeps negative feedback authoritative and never promotes dismissed work as positive collection evidence", () => {
    const id = ids[0]!;
    const projection = projectArtistCollection({
      artist,
      catalog: catalogAlbums,
      state: state({ savedAlbumIds: [id], likedAlbumIds: [id], favoriteAlbumIds: [id], listenedAlbumIds: [id], dismissedAlbumIds: [id], recentAlbumIds: [id] }),
    });
    const entry = projection.publishedAlbums.find((item) => item.albumId === id)!;
    expect(entry).toMatchObject({ primaryStatus: "DISMISSED", kept: false });
    expect(entry.states).toMatchObject({ saved: false, liked: false, favorite: false, markedListened: true, dismissed: true, recentlyViewed: true });
    expect(projection.keptAlbums).not.toContain(entry);
    expect(projection.dismissedAlbums).toContain(entry);
    expect(projection.markedListenedAlbums).toContain(entry);
  });

  it("keeps recent views as browsing-only support data and outside collection membership", () => {
    const id = ids[0]!;
    const projection = projectArtistCollection({ artist, catalog: catalogAlbums, state: state({ recentAlbumIds: [id] }) });
    expect(projection.recentlyViewedAlbums).toHaveLength(1);
    expect(projection.keptAlbums).toHaveLength(0);
    expect(projection.publishedAlbums.find((entry) => entry.albumId === id)).toMatchObject({ primaryStatus: "RECENTLY_VIEWED", kept: false });
  });

  it("projects every Artist deterministically without mutating catalog, index or state", () => {
    const localState = state({ favoriteAlbumIds: catalogAlbums.slice(0, 40).map((album) => album.id), recentAlbumIds: catalogAlbums.slice(20, 50).map((album) => album.id) });
    const before = [JSON.stringify(publishedArtists), JSON.stringify(catalogAlbums), JSON.stringify(localState)];
    const first = projectAllArtistCollections({ artists: publishedArtists, catalog: catalogAlbums, state: localState });
    const second = projectAllArtistCollections({ artists: publishedArtists, catalog: catalogAlbums, state: localState });
    const signature = (items: typeof first) => items.map((item) => [item.artist.artistId, item.publishedAlbums.map((entry) => entry.albumId), item.keptAlbums.map((entry) => entry.albumId), item.summary]);
    expect(signature(first)).toEqual(signature(second));
    expect(first).toHaveLength(453);
    expect([JSON.stringify(publishedArtists), JSON.stringify(catalogAlbums), JSON.stringify(localState)]).toEqual(before);
  });

  it("rejects an Artist membership not backed by a canonical Album credit", () => {
    const album = catalogAlbums.find((candidate) => !candidate.artists.some((credit) => credit.id === artist.artistId))!;
    expect(() => projectArtistCollection({ artist: { ...artist, albumCount: 1, albumIds: [album.id] }, catalog: catalogAlbums, state: null })).toThrow(/not backed by an Album credit/);
  });
});
