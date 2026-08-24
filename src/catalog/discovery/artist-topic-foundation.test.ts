import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import { discoverFromArtist } from "./candidate-engine";
import {
  validateArtistEscapeExplanation,
  validateDiscoveryExplanation,
  validateTopicEntryExplanation,
} from "./explanations";
import { parseDiscoveryPathContext } from "./path-context";
import { publishedDiscoveryIndex } from "./published-index";
import { discoverFromTopic, TOPIC_ENTRY_KINDS, type TopicEntryKind } from "./topic-entry";

function topicKeys(kind: TopicEntryKind) {
  return publishedDiscoveryIndex.nodes
    .filter((node) => node.type === kind)
    .map((node) => node.canonicalId);
}

afterEach(() => vi.unstubAllGlobals());

describe("R13-3D non-visible artist discovery foundation", { timeout: 180_000 }, () => {
  it("covers every real artist with deterministic multi-work chronology or single-work escape", () => {
    const results = publishedArtists.map((artist) => discoverFromArtist(
      publishedDiscoveryIndex,
      artist.artistId,
    ));

    expect(results).toHaveLength(453);
    expect(results.filter((result) => result.artistShape === "MULTI_WORK")).toHaveLength(156);
    expect(results.filter((result) => result.artistShape === "SINGLE_WORK")).toHaveLength(297);

    for (const [index, artist] of publishedArtists.entries()) {
      const result = results[index];
      expect(result.status).toBe("FOUND");
      expect(result.sourceArtist?.id).toBe(artist.artistId);
      expect(result.artistAlbumIds).toEqual(result.sourceWorks.map((work) => work.albumId));
      expect(result.anchorAlbumId).toBe(result.sourceWorks.at(-1)?.albumId);
      expect(result.primaryTargetType).toBe("ALBUM");
      expect(result.primaryTarget).not.toBeNull();
      expect(result.primaryEvidence).not.toBeNull();
      expect(result.alternates.length).toBeLessThanOrEqual(3);
      expect(JSON.stringify(result)).toBe(JSON.stringify(discoverFromArtist(
        publishedDiscoveryIndex,
        artist.artistId,
      )));

      if (artist.albumCount === 1) {
        expect(result.escapeReason).toBe("SINGLE_WORK_CROSS_ARTIST");
        expect(result.primaryTarget?.artistIds).not.toContain(artist.artistId);
        expect(result.primaryExplanation?.key).toBe("discovery.artist.escape");
        expect(validateArtistEscapeExplanation(
          publishedDiscoveryIndex,
          result.primaryEvidence!,
          result.primaryExplanation as Extract<typeof result.primaryExplanation, { key: "discovery.artist.escape" }>,
        )).toBe(true);
      } else {
        expect(result.primaryTarget?.artistIds).toContain(artist.artistId);
        expect(["CHRONOLOGY", "MULTI_WORK_RELATION"]).toContain(result.escapeReason);
        expect(result.primaryExplanation?.key).not.toBe("discovery.artist.escape");
        expect(validateDiscoveryExplanation(
          publishedDiscoveryIndex,
          result.primaryEvidence!,
          result.primaryExplanation as Exclude<typeof result.primaryExplanation, { key: "discovery.artist.escape" } | null>,
        )).toBe(true);
      }
    }
  }, 180_000);

  it("accepts a real chronology anchor and preserves an existing validated origin", () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    const anchorAlbumId = artist.albumIds[0];
    const originAlbum = catalogAlbums.find((album) => album.id !== anchorAlbumId)!;
    const result = discoverFromArtist(publishedDiscoveryIndex, artist.artistId, {
      anchorAlbumId,
      pathContext: {
        entryKind: "album",
        entryKey: originAlbum.slug,
        trailAlbumSlugs: [],
        transitionFamilies: [],
      },
    });
    expect(result.anchorAlbumId).toBe(anchorAlbumId);
    expect(result.pathContext).toMatchObject({ entryKind: "album", entryKey: originAlbum.slug });
    expect(result.chronologyContext?.anchorIndex).toBeGreaterThanOrEqual(0);
  });

  it("uses bounded path context to escape a repetitive same-artist loop", () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount === 2)!;
    const first = discoverFromArtist(publishedDiscoveryIndex, artist.artistId);
    expect(first.primaryTarget?.artistIds).toContain(artist.artistId);
    expect(first.discovery?.status).toBe("FOUND");
    const firstCandidate = first.discovery?.status === "FOUND" ? first.discovery.primary : null;
    const second = discoverFromArtist(publishedDiscoveryIndex, artist.artistId, {
      anchorAlbumId: first.primaryTarget!.albumId,
      pathContext: firstCandidate!.nextPathContext,
    });
    expect(second.primaryTarget?.artistIds).not.toContain(artist.artistId);
    expect(second.escapeReason).toBe("BOUNDED_PATH_CROSS_ARTIST");
  });

  it("returns a complete typed not-found result", () => {
    const result = discoverFromArtist(publishedDiscoveryIndex, "artist:missing");
    expect(result).toMatchObject({
      status: "NOT_FOUND",
      artistId: "artist:missing",
      primaryTarget: null,
      primaryExplanation: null,
      escapeReason: "NO_TARGET",
    });
  });
});

describe("R13-3D non-visible topic entry foundation", () => {
  it("covers every real topic with truthful deterministic album anchors", () => {
    const keysByKind = Object.fromEntries(TOPIC_ENTRY_KINDS.map((kind) => [kind, topicKeys(kind)]));
    expect(keysByKind).toMatchObject({
      PRIMARY_GENRE: expect.arrayContaining([]),
      SECONDARY_GENRE: expect.arrayContaining([]),
      ERA: expect.arrayContaining([]),
      LISTENING_CONTEXT: expect.arrayContaining([]),
    });
    expect(Object.values(keysByKind).flat()).toHaveLength(55);

    for (const kind of TOPIC_ENTRY_KINDS) {
      for (const key of keysByKind[kind]) {
        const result = discoverFromTopic(publishedDiscoveryIndex, kind, key);
        expect(result.status).toBe("FOUND");
        expect(result.primaryTargetType).toBe("ALBUM");
        expect(result.memberAlbumIds).toContain(result.primaryTarget?.albumId);
        expect(result.alternates.length).toBeLessThanOrEqual(3);
        expect(new Set([result.primaryTarget?.albumId, ...result.alternates.map((entry) => entry.albumId)]).size)
          .toBe(1 + result.alternates.length);
        expect(validateTopicEntryExplanation(
          publishedDiscoveryIndex,
          result.primaryTarget!.explanation,
        )).toBe(true);
        expect(JSON.stringify(result)).toBe(JSON.stringify(discoverFromTopic(
          publishedDiscoveryIndex,
          kind,
          key,
        )));

        const query = new URL(result.primaryTarget!.href, "https://local.test").searchParams;
        expect(parseDiscoveryPathContext(query, publishedDiscoveryIndex)).toEqual(result.pathContext);
      }
    }
  }, 180_000);

  it("preserves a prior discovery origin while adapting a topic to an album", () => {
    const topicKey = topicKeys("PRIMARY_GENRE")[0];
    const source = catalogAlbums[0];
    const result = discoverFromTopic(publishedDiscoveryIndex, "PRIMARY_GENRE", topicKey, {
      pathContext: {
        entryKind: "album",
        entryKey: source.slug,
        trailAlbumSlugs: [],
        transitionFamilies: [],
      },
    });
    expect(result.pathContext).toMatchObject({ entryKind: "album", entryKey: source.slug });
  });

  it("rejects unsupported topic identities and performs no external access", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(discoverFromTopic(publishedDiscoveryIndex, "ERA", "missing-era")).toMatchObject({
      status: "NOT_FOUND",
      primaryTarget: null,
      discovery: null,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
