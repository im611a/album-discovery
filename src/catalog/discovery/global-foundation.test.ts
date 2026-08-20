import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import { discoverFromAlbum, discoverFromArtist } from "./candidate-engine";
import { buildExploreEntry } from "./explore-entry";
import { buildAlbumDiscoveryPresentation } from "./presentation";
import { publishedDiscoveryIndex } from "./published-index";
import { auditDiscoveryReachability, simulateDiscoveryPaths } from "./quality-harness";
import { discoverFromTopic, TOPIC_ENTRY_KINDS } from "./topic-entry";

afterEach(() => vi.unstubAllGlobals());

describe("R13-3F global discovery quality foundation", () => {
  it("completes 2,000 mixed-origin transitions without avoidable loops or evidence failures", () => {
    const report = simulateDiscoveryPaths(publishedDiscoveryIndex, catalogAlbums, {
      seedCount: 100,
      stepsPerSeed: 20,
    });
    expect(report.summary).toMatchObject({
      requestedTransitions: 2_000,
      completedTransitions: 2_000,
      deadEnds: 0,
      immediateReversals: 0,
      avoidableShortLoops: 0,
      explanationFailures: 0,
      deterministicReplayFailures: 0,
    });
    expect(Object.keys(report.summary.originTypeCounts).sort()).toEqual([
      "ALBUM",
      "ARTIST",
      "ERA",
      "LISTENING_CONTEXT",
      "PRIMARY_GENRE",
      "SECONDARY_GENRE",
    ]);
    expect(report.paths).toHaveLength(100);
    expect(report.paths.every((path) => path.transitions.length === 20)).toBe(true);
  }, 60_000);

  it("keeps every selected graph target resolvable and reports catalog reachability honestly", () => {
    const audit = auditDiscoveryReachability(publishedDiscoveryIndex, catalogAlbums);
    expect(audit.catalogAlbumCount).toBe(357);
    expect(audit.isolatedAlbums).toEqual([]);
    expect(audit.isolatedArtists).toEqual([]);
    expect(audit.weakComponentCount).toBeGreaterThanOrEqual(1);
    expect(audit.weakComponents.flat()).toHaveLength(catalogAlbums.length);
    expect(new Set(audit.weakComponents.flat()).size).toBe(catalogAlbums.length);
    expect(audit.candidatePoolStats.minimum).toBeGreaterThan(0);
    expect(audit.classification.rankingChangeApplied).toBe(false);
  });

  it("enforces valid unique targets across Album, Artist, and topic origins", () => {
    for (const album of catalogAlbums) {
      const result = discoverFromAlbum(publishedDiscoveryIndex, album.id);
      expect(result.status).toBe("FOUND");
      if (result.status !== "FOUND") continue;
      const targetIds = result.options.map((candidate) => candidate.targetAlbumId);
      expect(targetIds).not.toContain(album.id);
      expect(new Set(targetIds).size).toBe(targetIds.length);
      expect(targetIds.every((albumId) => publishedDiscoveryIndex.albumFactsById.has(albumId))).toBe(true);
    }
    for (const artist of publishedArtists) {
      const result = discoverFromArtist(publishedDiscoveryIndex, artist.artistId);
      expect(result.status).toBe("FOUND");
      expect(result.primaryTarget && publishedDiscoveryIndex.albumFactsById.has(result.primaryTarget.albumId)).toBe(true);
    }
    for (const kind of TOPIC_ENTRY_KINDS) {
      for (const node of publishedDiscoveryIndex.nodes.filter((candidate) => candidate.type === kind)) {
        const result = discoverFromTopic(publishedDiscoveryIndex, kind, node.canonicalId);
        expect(result.status).toBe("FOUND");
        expect(result.primaryTarget && result.memberAlbumIds.includes(result.primaryTarget.albumId)).toBe(true);
      }
    }
  }, 30_000);

  it("keeps presentation copy free of rank internals, raw enums, scores, and counts", () => {
    const serialized = JSON.stringify(catalogAlbums.map((album) => {
      const presentation = buildAlbumDiscoveryPresentation(album.id)!;
      return [presentation.primary, ...presentation.alternates].map((option) => ({
        lens: option?.lens,
        explanation: option?.explanation,
      }));
    }));
    expect(serialized).not.toMatch(/SAME_[A-Z_]+|SHARED_[A-Z_]+|ADJACENT_ERA|CHRONOLOGICAL_NEIGHBOR/);
    expect(serialized).not.toMatch(/SPECIFIC|COMPOUND|LOCAL|FALLBACK|rankKey|candidatePool|score|评分|\d+%/i);
  });

  it("keeps random and relation entry offline, deterministic, and structurally distinct", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (let index = 0; index < 1_000; index += 1) {
      const request = { mode: "RANDOM_ENTRY" as const, seed: `global-${index}` };
      const result = buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, request);
      expect(result).toEqual(buildExploreEntry(publishedDiscoveryIndex, catalogAlbums, request));
      expect(result.explanation).toBeNull();
      expect(result.relationEvidence).toBeNull();
      expect(result.target?.href).toMatch(/^\/albums\/[a-z0-9-]+\?entry=explore$/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30_000);
});
