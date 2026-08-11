import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import type { PublishedArtistIndex } from "../schema";
import { discoverFromAlbum, discoverFromArtist, type DiscoveryResult } from "./candidate-engine";
import { validateDiscoveryExplanation } from "./explanations";
import { buildDiscoveryIndex, getAlbumRelationEvidence } from "./relation-index";
import { publishedDiscoveryIndex } from "./published-index";
import type { DiscoveryPathContext, DiscoveryTransitionFamily } from "./path-context";

const contextWith = (...transitionFamilies: DiscoveryTransitionFamily[]): DiscoveryPathContext => ({
  trailAlbumSlugs: [],
  transitionFamilies,
});

function found(albumId: string, context?: DiscoveryPathContext) {
  const result = discoverFromAlbum(publishedDiscoveryIndex, albumId, context);
  if (result.status !== "FOUND") throw new Error(`Expected discovery options for ${albumId}.`);
  return result;
}

function selectedProjection(result: DiscoveryResult) {
  return result.options.map((candidate) => ({
    targetAlbumId: candidate.targetAlbumId,
    transitionFamily: candidate.transitionFamily,
    explanation: candidate.explanation,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("R13 deterministic explainable discovery engine", () => {
  it("returns no self or duplicate selection for all 345 source albums", () => {
    for (const album of catalogAlbums) {
      const result = found(album.id);
      const targetIds = result.options.map((candidate) => candidate.targetAlbumId);
      expect(targetIds).not.toContain(album.id);
      expect(new Set(targetIds).size).toBe(targetIds.length);
      expect(result.primary).toBe(result.options[0]);
      expect(result.alternates).toEqual(result.options.slice(1));
      expect(result.alternates).not.toContain(result.primary);
      expect(result.alternates.length).toBeLessThanOrEqual(3);
    }
  });

  it("backs every selected explanation with the exact real relation evidence", () => {
    for (const album of catalogAlbums) {
      const result = found(album.id);
      for (const candidate of result.options) {
        const relationEvidence = getAlbumRelationEvidence(
          publishedDiscoveryIndex,
          album.id,
          candidate.targetAlbumId,
        );
        expect(relationEvidence).not.toBeNull();
        expect(candidate.relations).toEqual(relationEvidence?.relations);
        expect(validateDiscoveryExplanation(
          publishedDiscoveryIndex,
          relationEvidence!,
          candidate.explanation,
        )).toBe(true);
      }
    }
  });

  it("replays byte-identical ordered output from the same input", () => {
    const source = catalogAlbums.find((album) => album.slug === "ok-computer")!;
    const context: DiscoveryPathContext = {
      entryKind: "album",
      entryKey: source.slug,
      trailAlbumSlugs: ["rumours", "loveless"],
      transitionFamilies: ["SHARED_SECONDARY", "PRIMARY_ONLY"],
    };
    expect(JSON.stringify(discoverFromAlbum(publishedDiscoveryIndex, source.id, context)))
      .toBe(JSON.stringify(discoverFromAlbum(publishedDiscoveryIndex, source.id, context)));
  });

  it("keeps ordering stable when catalog and membership insertion order is reversed", () => {
    const reversedIndex = buildDiscoveryIndex([...catalogAlbums].reverse(), [...publishedArtists].reverse());
    for (const source of catalogAlbums) {
      const canonical = found(source.id);
      const reversed = discoverFromAlbum(reversedIndex, source.id);
      expect(reversed.status).toBe("FOUND");
      expect(selectedProjection(reversed as DiscoveryResult)).toEqual(selectedProjection(canonical));
    }
  });

  it("hard-filters immediate A to B to A reversals", () => {
    for (const source of catalogAlbums) {
      const first = found(source.id);
      const target = first.primary!;
      const next = found(target.targetAlbumId, target.nextPathContext);
      expect(next.options.map((candidate) => candidate.targetAlbumId)).not.toContain(source.id);
    }
  });

  it("preserves bounded trail behavior through serialization and parsing", async () => {
    const { parseDiscoveryPathContext, serializeDiscoveryPathContext } = await import("./path-context");
    const source = catalogAlbums.find((album) => album.slug === "loveless")!;
    const context: DiscoveryPathContext = {
      entryKind: "primary-genre",
      entryKey: source.coreGenres[0],
      trailAlbumSlugs: ["rumours", "blue-joni-mitchell", "ok-computer"],
      transitionFamilies: ["SHARED_SECONDARY", "PRIMARY_ONLY", "PRIMARY_SAME_ERA"],
    };
    const reparsed = parseDiscoveryPathContext(serializeDiscoveryPathContext(context), publishedDiscoveryIndex);
    expect(selectedProjection(found(source.id, reparsed))).toEqual(selectedProjection(found(source.id, context)));
  });

  it("diversifies a repeated same-artist primary when a truthful alternative exists", () => {
    const example = catalogAlbums.map((album) => ({
      canonical: found(album.id),
      diversified: found(album.id, contextWith("SHARED_ARTIST")),
    })).find(({ canonical, diversified }) =>
      canonical.primary && ["CLEAN_CHRONOLOGY", "SHARED_ARTIST"].includes(canonical.primary.transitionFamily)
      && diversified.primary && !["CLEAN_CHRONOLOGY", "SHARED_ARTIST"].includes(diversified.primary.transitionFamily));
    expect(example).toBeDefined();
  });

  it("diversifies repeated primary-genre transitions when another family exists", () => {
    const example = catalogAlbums.map((album) => ({
      canonical: found(album.id),
      diversified: found(album.id, contextWith("PRIMARY_ONLY", "PRIMARY_SAME_ERA")),
    })).find(({ canonical, diversified }) =>
      canonical.primary?.transitionFamily.startsWith("PRIMARY")
      && diversified.primary && !diversified.primary.transitionFamily.startsWith("PRIMARY"));
    expect(example).toBeDefined();
  });

  it("diversifies repeated same-era transitions toward a different era when available", () => {
    const example = catalogAlbums.map((album) => {
      const canonical = found(album.id);
      const diversified = found(album.id, contextWith("ERA_SAME", "CONTEXT_SAME_ERA"));
      const sourceEra = publishedDiscoveryIndex.albumFactsById.get(album.id)?.era;
      return { canonical, diversified, sourceEra };
    }).find(({ canonical, diversified, sourceEra }) => {
      const canonicalEra = canonical.primary && publishedDiscoveryIndex.albumFactsById.get(canonical.primary.targetAlbumId)?.era;
      const diversifiedEra = diversified.primary && publishedDiscoveryIndex.albumFactsById.get(diversified.primary.targetAlbumId)?.era;
      return canonicalEra === sourceEra && diversifiedEra !== sourceEra;
    });
    expect(example).toBeDefined();
  });

  it("keeps a truthful single-option path instead of fabricating variety", () => {
    const selectedAlbums = [
      catalogAlbums.find((album) => album.slug === "rumours")!,
      catalogAlbums.find((album) => album.slug === "blue-joni-mitchell")!,
    ];
    const albumIds = new Set(selectedAlbums.map((album) => album.id));
    const artistIds = new Set(selectedAlbums.flatMap((album) => album.artists.map((artist) => artist.id)));
    const artists: PublishedArtistIndex[] = publishedArtists
      .filter((artist) => artistIds.has(artist.artistId))
      .map((artist) => ({
        ...artist,
        albumIds: artist.albumIds.filter((albumId) => albumIds.has(albumId)),
      }));
    const index = buildDiscoveryIndex(selectedAlbums, artists);
    const result = discoverFromAlbum(index, selectedAlbums[0].id);
    expect(result.status).toBe("FOUND");
    expect((result as DiscoveryResult).options.map((candidate) => candidate.targetAlbumId))
      .toEqual([selectedAlbums[1].id]);
  });

  it("uses only the seven accepted relation families", () => {
    const accepted = new Set([
      "SAME_ARTIST",
      "SAME_PRIMARY_GENRE",
      "SHARED_SECONDARY_GENRE",
      "SAME_ERA",
      "ADJACENT_ERA",
      "CHRONOLOGICAL_NEIGHBOR",
      "SHARED_LISTENING_CONTEXT",
    ]);
    for (const album of catalogAlbums) {
      for (const candidate of found(album.id).options) {
        expect(candidate.relations.every((relation) => accepted.has(relation.type))).toBe(true);
      }
    }
  });

  it("preserves actual secondary, context, artist, and chronology values", () => {
    const rumours = catalogAlbums.find((album) => album.slug === "rumours")!;
    const blue = catalogAlbums.find((album) => album.slug === "blue-joni-mitchell")!;
    const minimalIds = new Set([rumours.id, blue.id]);
    const minimalArtistIds = new Set([rumours, blue].flatMap((album) => album.artists.map((artist) => artist.id)));
    const minimalArtists = publishedArtists.filter((artist) => minimalArtistIds.has(artist.artistId)).map((artist) => ({
      ...artist,
      albumIds: artist.albumIds.filter((albumId) => minimalIds.has(albumId)),
    }));
    const secondaryResult = discoverFromAlbum(buildDiscoveryIndex([rumours, blue], minimalArtists), rumours.id);
    expect(secondaryResult.status).toBe("FOUND");
    expect((secondaryResult as DiscoveryResult).primary?.explanation.evidence.secondaryGenres).toEqual(["folk-pop"]);

    const contextCandidate = catalogAlbums.map((album) => found(album.id)).flatMap((result) => result.options)
      .find((candidate) => candidate.explanation.relation === "SHARED_LISTENING_CONTEXT");
    expect(contextCandidate?.explanation.evidence.listeningContexts).toEqual(expect.any(Array));
    expect((contextCandidate?.explanation.evidence.listeningContexts as readonly string[]).length).toBeGreaterThan(0);

    const artistCandidate = catalogAlbums.map((album) => found(album.id)).flatMap((result) => result.options)
      .find((candidate) => candidate.relations.some((relation) => relation.type === "SAME_ARTIST"));
    const artistEvidence = artistCandidate?.relations.find((relation) => relation.type === "SAME_ARTIST");
    expect(artistEvidence?.artistIds.length).toBeGreaterThan(0);

    const chronologyCandidate = catalogAlbums.map((album) => found(album.id)).flatMap((result) => result.options)
      .find((candidate) => candidate.transitionFamily === "CLEAN_CHRONOLOGY");
    const chronology = chronologyCandidate?.relations.find((relation) => relation.type === "CHRONOLOGICAL_NEIGHBOR");
    expect(chronology?.neighbors.every((neighbor) => {
      const ordered = publishedDiscoveryIndex.chronologyByArtistId.get(neighbor.artistId) ?? [];
      const sourceIndex = ordered.findIndex((entry) => entry.albumId === chronologyCandidate?.sourceAlbumId);
      const targetIndex = ordered.findIndex((entry) => entry.albumId === chronologyCandidate?.targetAlbumId);
      return Math.abs(sourceIndex - targetIndex) === 1;
    })).toBe(true);
  });

  it("supports multi-work chronology and single-work cross-artist escape through the same engine", () => {
    const multi = publishedArtists.find((artist) => artist.albumCount > 1
      && artist.albumIds.every((albumId) => publishedDiscoveryIndex.albumFactsById.get(albumId)?.artistIds.length === 1));
    if (!multi) throw new Error("Expected a clean multi-work artist.");
    const multiResult = discoverFromArtist(publishedDiscoveryIndex, multi.artistId);
    expect(multiResult.status).toBe("FOUND");
    expect(multiResult.discovery?.status).toBe("FOUND");
    expect((multiResult.discovery as DiscoveryResult).options.some((candidate) =>
      candidate.relations.some((relation) => relation.type === "SAME_ARTIST" && relation.artistIds.includes(multi.artistId)))).toBe(true);

    const single = publishedArtists.find((artist) => artist.albumCount === 1)!;
    const singleResult = discoverFromArtist(publishedDiscoveryIndex, single.artistId);
    expect(singleResult.status).toBe("FOUND");
    expect(singleResult.discovery?.status).toBe("FOUND");
    const target = publishedDiscoveryIndex.albumFactsById.get((singleResult.discovery as DiscoveryResult).primary!.targetAlbumId)!;
    expect(target.artistIds).not.toContain(single.artistId);
  });

  it("returns a typed not-found result and performs no runtime external access", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(discoverFromAlbum(publishedDiscoveryIndex, "album:missing")).toEqual({
      status: "NOT_FOUND",
      sourceAlbumId: "album:missing",
    });
    discoverFromAlbum(publishedDiscoveryIndex, catalogAlbums[0].id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
