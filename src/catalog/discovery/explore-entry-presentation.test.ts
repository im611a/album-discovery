import { describe, expect, it } from "vitest";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import {
  buildExploreRandomPresentation,
  buildExploreRelationPresentation,
  getExploreRelationChoices,
  resolveExploreRelationChoice,
} from "./explore-entry-presentation";
import { getTopicSummaries } from "../topics";

describe("R13-3E visible Explore presentation", { timeout: 180_000 }, () => {
  it("maps all 508 visible relation choices to deterministic valid entries", () => {
    const choices = ["genre", "decade", "scene", "artist"].flatMap((mode) =>
      getExploreRelationChoices(mode as "genre" | "decade" | "scene" | "artist"));
    expect(choices).toHaveLength(508);
    expect(choices.filter((choice) => choice.source.kind === "PRIMARY_GENRE")).toHaveLength(15);
    expect(choices.filter((choice) => choice.source.kind === "SECONDARY_GENRE")).toHaveLength(24);
    expect(choices.filter((choice) => choice.source.kind === "ERA")).toHaveLength(9);
    expect(choices.filter((choice) => choice.source.kind === "LISTENING_CONTEXT")).toHaveLength(7);
    expect(choices.filter((choice) => choice.source.kind === "ARTIST")).toHaveLength(453);
    for (const choice of choices) {
      const presentation = buildExploreRelationPresentation(choice);
      expect(presentation).not.toBeNull();
      expect(presentation?.authority).toBe("RELATION");
      expect(presentation?.primary.href).toMatch(/^\/albums\/.+\?entry=explore/);
      expect(presentation?.primary.explanation).not.toBe("");
      expect(presentation?.alternates.length).toBeLessThanOrEqual(3);
      expect(new Set([
        presentation!.primary.target.id,
        ...presentation!.alternates.map((option) => option.target.id),
      ]).size).toBe(1 + presentation!.alternates.length);
      expect(JSON.stringify(presentation)).toBe(JSON.stringify(buildExploreRelationPresentation(choice)));
    }
  }, 180_000);

  it("keeps primary and secondary genre identities distinct while preserving old URLs", () => {
    const sharedKey = getTopicSummaries("core").find((core) =>
      getTopicSummaries("related").some((related) => related.key === core.key))!.key;
    expect(resolveExploreRelationChoice("genre", sharedKey, "core")?.source.kind).toBe("PRIMARY_GENRE");
    expect(resolveExploreRelationChoice("genre", sharedKey, "related")?.source.kind).toBe("SECONDARY_GENRE");
    expect(resolveExploreRelationChoice("genre", sharedKey, null)?.source.kind).toBe("PRIMARY_GENRE");
  });

  it("structurally isolates fixed-seed serendipity from every relation claim", () => {
    const first = buildExploreRandomPresentation("shared-42")!;
    const replay = buildExploreRandomPresentation("shared-42");
    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      authority: "SERENDIPITY",
      relationFamily: null,
      explanationKey: null,
      explanation: null,
    });
    expect(first.href).toMatch(/^\/albums\/.+\?entry=explore/);
    expect(first.target.id).toBe(catalogAlbums.find((album) => album.id === first.target.id)?.id);
  });

  it("honors local random dismissal without changing the fixed URL seed", () => {
    const first = buildExploreRandomPresentation("shared-42")!;
    const next = buildExploreRandomPresentation("shared-42", [first.target.id])!;
    expect(next.target.id).not.toBe(first.target.id);
    expect(next.seed).toBe(first.seed);
    expect(next.pathContext).toBe("entry=explore");
  });

  it("resolves every published Artist and every authorized Topic in visible choices", () => {
    expect(getExploreRelationChoices("artist").map((choice) => choice.value)).toEqual(
      publishedArtists.map((artist) => artist.artistId),
    );
    expect(getExploreRelationChoices("genre").length).toBe(
      getTopicSummaries("core").length + getTopicSummaries("related").length,
    );
  });
});
