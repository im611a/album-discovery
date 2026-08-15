import { describe, expect, it } from "vitest";
import { allocateDeterministicSlugs, buildArtistAuthority, classifyDuplicate, resolveAlbumArtists } from "./identity.mjs";
import { ARTIST_STATE, DUPLICATE_STATE } from "./contracts.mjs";

const album = (id, title, artistId = "10", artistName = "Artist", overrides = {}) => ({
  neteaseAlbumId: id,
  slug: `existing-${id}`,
  title,
  artists: [{ neteaseArtistId: artistId, name: artistName }],
  releaseDate: "2020-01-01",
  albumType: "album",
  ...overrides,
});

describe("Content Pipeline identity contracts", () => {
  it("allocates batch slug collisions independently of row order", () => {
    const proposals = [{ albumId: "9002", title: "Same Title" }, { albumId: "9001", title: "Same Title" }];
    const forward = allocateDeterministicSlugs(proposals, { albums: [] });
    const reverse = allocateDeterministicSlugs([...proposals].reverse(), { albums: [] });
    expect(forward.map(({ albumId, slug }) => [albumId, slug])).toEqual(reverse.map(({ albumId, slug }) => [albumId, slug]));
    expect(forward.map((item) => item.slug)).toEqual(["same-title-9001", "same-title-9002"]);
  });

  it("suffixes a base slug that collides with the frozen catalog", () => {
    const [result] = allocateDeterministicSlugs([{ albumId: "9001", title: "Existing" }], { albums: [{ slug: "existing" }] });
    expect(result.slug).toBe("existing-9001");
  });

  it("retains the NetEase-ID fallback for non-Latin titles", () => {
    const [result] = allocateDeterministicSlugs([{ albumId: "9001", title: "新专辑" }], { albums: [] });
    expect(result.slug).toBe("netease-album-9001");
  });

  it("keeps long-title allocation deterministic without a random suffix", () => {
    const title = "A Very Long Synthetic Album Title With Punctuation — Volume One";
    const first = allocateDeterministicSlugs([{ albumId: "9001", title }], { albums: [] });
    const second = allocateDeterministicSlugs([{ albumId: "9001", title }], { albums: [] });
    expect(first).toEqual(second);
    expect(first[0].slug).toBe("a-very-long-synthetic-album-title-with-punctuation-volume-one");
  });

  it("resolves existing and new positive Artist IDs without name inference", () => {
    const authority = buildArtistAuthority({ albums: [album("1", "A", "10", "Known")] });
    const result = resolveAlbumArtists([{ neteaseArtistId: "10", name: "Known" }, { neteaseArtistId: "11", name: "New" }], authority);
    expect(result.states.map((item) => item.state)).toEqual([ARTIST_STATE.RESOLVED_EXISTING_ARTIST, ARTIST_STATE.CREATE_NEW_ARTIST]);
  });

  it("holds name-only evidence and rejects Artist ID zero", () => {
    const authority = buildArtistAuthority({ albums: [album("1", "A", "10", "Known")] });
    expect(resolveAlbumArtists([{ neteaseArtistId: "", name: "Known" }], authority).states[0].state).toBe(ARTIST_STATE.AMBIGUOUS_ARTIST);
    expect(resolveAlbumArtists([{ neteaseArtistId: "0", name: "Unknown" }], authority).states[0].state).toBe(ARTIST_STATE.INVALID_ARTIST_ID);
  });

  it("holds an existing Artist ID/name conflict and rejects duplicate conflicting credits", () => {
    const authority = buildArtistAuthority({ albums: [album("1", "A", "10", "Known")] });
    expect(resolveAlbumArtists([{ neteaseArtistId: "10", name: "Different" }], authority).states[0].state).toBe(ARTIST_STATE.ARTIST_ID_NAME_CONFLICT);
    const duplicate = resolveAlbumArtists([{ neteaseArtistId: "11", name: "One" }, { neteaseArtistId: "11", name: "Two" }], authority);
    expect(duplicate.states[1].state).toBe(ARTIST_STATE.DUPLICATE_ARTIST_ID_CONFLICT);
  });

  it("classifies exact, likely, edition and distinct Albums without merging", () => {
    const catalog = { albums: [album("1", "Original")] };
    expect(classifyDuplicate(album("1", "Other"), catalog).state).toBe(DUPLICATE_STATE.EXACT_DUPLICATE);
    expect(classifyDuplicate(album("2", "Original"), catalog).state).toBe(DUPLICATE_STATE.LIKELY_DUPLICATE);
    expect(classifyDuplicate(album("3", "Original Deluxe Edition"), catalog).state).toBe(DUPLICATE_STATE.POSSIBLE_EDITION);
    expect(classifyDuplicate(album("4", "Different"), catalog).state).toBe(DUPLICATE_STATE.DISTINCT);
  });
});
