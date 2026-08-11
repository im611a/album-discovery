import { describe, expect, it } from "vitest";
import { catalogAlbums } from "../published-catalog";
import {
  buildDiscoveryExplanation,
  DISCOVERY_EXPLANATION_KEYS,
  validateDiscoveryExplanation,
} from "./explanations";
import { getAlbumRelationEvidence } from "./relation-index";
import { publishedDiscoveryIndex } from "./published-index";

const albumId = (slug: string) => {
  const album = catalogAlbums.find((candidate) => candidate.slug === slug);
  if (!album) throw new Error(`Missing album fixture ${slug}.`);
  return album.id;
};

describe("R13 centralized discovery explanations", () => {
  it("selects the shared-secondary key with the actual genre", () => {
    const evidence = getAlbumRelationEvidence(
      publishedDiscoveryIndex,
      albumId("rumours"),
      albumId("blue-joni-mitchell"),
    )!;
    const explanation = buildDiscoveryExplanation(publishedDiscoveryIndex, evidence, "SHARED_SECONDARY");
    expect(explanation).toMatchObject({
      key: "discovery.secondary.shared",
      relation: "SHARED_SECONDARY_GENRE",
      evidence: { secondaryGenres: ["folk-pop"] },
    });
    expect(validateDiscoveryExplanation(publishedDiscoveryIndex, evidence, explanation!)).toBe(true);
  });

  it("retains actual listening-context and era bridge facts", () => {
    const evidence = getAlbumRelationEvidence(
      publishedDiscoveryIndex,
      albumId("ok-computer"),
      albumId("loveless"),
    )!;
    const explanation = buildDiscoveryExplanation(publishedDiscoveryIndex, evidence, "CONTEXT_SAME_ERA");
    expect(explanation).toMatchObject({
      key: "discovery.context.era_bridge",
      relation: "SHARED_LISTENING_CONTEXT",
      evidence: {
        listeningContexts: ["focus", "night"],
        sourceEra: "1990s",
        targetEra: "1990s",
      },
    });
  });

  it("rejects an explanation basis when its required evidence is removed", () => {
    const original = getAlbumRelationEvidence(
      publishedDiscoveryIndex,
      albumId("rumours"),
      albumId("blue-joni-mitchell"),
    )!;
    const withoutSecondary = {
      ...original,
      relations: original.relations.filter((relation) => relation.type !== "SHARED_SECONDARY_GENRE"),
    };
    expect(buildDiscoveryExplanation(publishedDiscoveryIndex, withoutSecondary, "SHARED_SECONDARY")).toBeNull();
  });

  it("uses only centralized allowlisted keys and structured data, never finished UI prose", () => {
    const serialized = JSON.stringify(DISCOVERY_EXPLANATION_KEYS);
    expect(serialized).not.toMatch(/你可能会喜欢|为你推荐|热门推荐|AI 推荐|相似度|%/);
    expect(new Set(DISCOVERY_EXPLANATION_KEYS).size).toBe(DISCOVERY_EXPLANATION_KEYS.length);
  });

  it("derives clean chronology direction from actual release years", () => {
    for (const chronology of publishedDiscoveryIndex.chronologyByArtistId.values()) {
      if (chronology.length < 2) continue;
      const evidence = getAlbumRelationEvidence(
        publishedDiscoveryIndex,
        chronology[0].albumId,
        chronology[1].albumId,
      );
      const sameArtist = evidence?.relations.find((relation) => relation.type === "SAME_ARTIST");
      const chronological = evidence?.relations.find((relation) => relation.type === "CHRONOLOGICAL_NEIGHBOR");
      if (!evidence || !sameArtist || !chronological || sameArtist.sourceCreditCount !== 1
        || sameArtist.targetCreditCount !== 1 || chronology[0].releaseYear === chronology[1].releaseYear) continue;
      const explanation = buildDiscoveryExplanation(publishedDiscoveryIndex, evidence, "CLEAN_CHRONOLOGY");
      expect(explanation?.key).toBe(
        (chronology[1].releaseYear ?? 0) > (chronology[0].releaseYear ?? 0)
          ? "discovery.artist.later"
          : "discovery.artist.earlier",
      );
      return;
    }
    throw new Error("Expected a clean chronology explanation fixture.");
  });
});
