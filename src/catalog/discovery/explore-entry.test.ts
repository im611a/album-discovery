import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import {
  validateArtistEscapeExplanation,
  validateDiscoveryExplanation,
  validateTopicEntryExplanation,
} from "./explanations";
import { buildExploreEntry, type ExploreRelationSource } from "./explore-entry";
import { parseDiscoveryPathContext } from "./path-context";
import { publishedDiscoveryIndex } from "./published-index";
import { TOPIC_ENTRY_KINDS } from "./topic-entry";

afterEach(() => vi.unstubAllGlobals());

describe("R13-3E non-visible Explore entry adapter", () => {
  it("keeps stable random separate from relation discovery", () => {
    const request = { mode: "RANDOM_ENTRY" as const, seed: "shareable-seed" };
    const first = buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, request);
    const replay = buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, request);
    expect(first).toEqual(replay);
    expect(first.status).toBe("FOUND");
    expect(first.explanation).toBeNull();
    expect(first.relation).toBeNull();
    expect(first.relationEvidence).toBeNull();
    expect(first.pathContext.entryKind).toBe("explore");
  });

  it("honors the existing stable-random dismissal contract without inventing a relation", () => {
    const first = buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, {
      mode: "RANDOM_ENTRY",
      seed: "12345",
    });
    const next = buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, {
      mode: "RANDOM_ENTRY",
      seed: "12345",
      dismissedAlbumIds: first.target ? [first.target.albumId] : [],
    });
    expect(next.target?.albumId).not.toBe(first.target?.albumId);
    expect(next.explanation).toBeNull();
  });

  it("adapts every accepted relation source kind through the established engines", () => {
    const topicSources = TOPIC_ENTRY_KINDS.map((kind) => ({
      kind,
      key: publishedDiscoveryIndex.nodes.find((node) => node.type === kind)!.canonicalId,
    }));
    const sources: ExploreRelationSource[] = [
      { kind: "ALBUM", key: catalogAlbums[0].id },
      { kind: "ARTIST", key: publishedArtists[0].artistId },
      ...topicSources,
    ];

    for (const source of sources) {
      const result = buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, {
        mode: "RELATION_ENTRY",
        source,
      });
      expect(result.status).toBe("FOUND");
      expect(result.target).not.toBeNull();
      expect(result.explanation).not.toBeNull();
      expect(result.pathContext.entryKind).toBe("explore");
      expect(JSON.stringify(result)).toBe(JSON.stringify(buildExploreEntry(
        publishedDiscoveryIndex,
        catalogAlbums,
        { mode: "RELATION_ENTRY", source },
      )));
      const query = new URL(result.target!.href, "https://local.test").searchParams;
      expect(parseDiscoveryPathContext(query, publishedDiscoveryIndex).entryKind).toBe("explore");

      if (result.explanation?.key === "discovery.artist.escape") {
        expect(validateArtistEscapeExplanation(
          publishedDiscoveryIndex,
          result.relationEvidence!,
          result.explanation,
        )).toBe(true);
      } else if (result.explanation?.key === "discovery.topic.to_album") {
        expect(validateTopicEntryExplanation(publishedDiscoveryIndex, result.explanation)).toBe(true);
      } else {
        expect(validateDiscoveryExplanation(
          publishedDiscoveryIndex,
          result.relationEvidence!,
          result.explanation!,
        )).toBe(true);
      }
    }
  });

  it("returns typed missing and empty results", () => {
    expect(buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, {
      mode: "RELATION_ENTRY",
      source: { kind: "ALBUM", key: "album:missing" },
    })).toMatchObject({ status: "NOT_FOUND", target: null, explanation: null });
    expect(buildExploreEntry(publishedDiscoveryIndex, [], {
      mode: "RANDOM_ENTRY",
      seed: "empty",
    })).toMatchObject({ status: "EMPTY", target: null, explanation: null });
  });

  it("uses only local static data", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, {
      mode: "RELATION_ENTRY",
      source: { kind: "ALBUM", key: catalogAlbums[0].id },
    });
    buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, {
      mode: "RANDOM_ENTRY",
      seed: "offline",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
