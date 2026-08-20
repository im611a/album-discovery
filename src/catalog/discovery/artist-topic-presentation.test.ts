import { describe, expect, it } from "vitest";
import { catalogAlbums, publishedArtists } from "../published-catalog";
import { getTopicSummaries, type TopicKind } from "../topics";
import {
  buildArtistDiscoveryPresentation,
  buildArtistDiscoveryPresentationFromSearchParams,
  buildDiscoveryEntityHref,
  buildTopicDiscoveryPresentation,
  buildTopicDiscoveryPresentationFromSearchParams,
} from "./artist-topic-presentation";
import { parseDiscoveryPathContext } from "./path-context";
import { publishedDiscoveryIndex } from "./published-index";

const topicKinds: TopicKind[] = ["core", "related", "decade", "scene"];

describe("R13-3D visible Artist presentation", () => {
  it("adapts all 300 artists without changing engine authority", () => {
    const presentations = publishedArtists.map((artist) =>
      buildArtistDiscoveryPresentation(artist.artistId));
    expect(presentations).toHaveLength(300);
    expect(presentations.every(Boolean)).toBe(true);
    expect(presentations.filter((item) => item?.source.shape === "MULTI_WORK")).toHaveLength(62);
    expect(presentations.filter((item) => item?.source.shape === "SINGLE_WORK")).toHaveLength(238);
    for (const presentation of presentations) {
      const targetIds = [
        presentation!.primary.target.id,
        ...presentation!.alternates.map((option) => option.target.id),
      ];
      expect(new Set(targetIds).size).toBe(targetIds.length);
      expect(targetIds.every((albumId) => publishedDiscoveryIndex.albumFactsById.has(albumId))).toBe(true);
      expect(presentation!.alternates.length).toBeLessThanOrEqual(3);
      expect(JSON.stringify(presentation)).toBe(JSON.stringify(
        buildArtistDiscoveryPresentation(presentation!.source.id),
      ));
    }
  }, 30_000);

  it("keeps multi-work chronology primary and gives single-work artists a factual Album escape", () => {
    const multi = publishedArtists.find((artist) => artist.albumCount === 2)!;
    const single = publishedArtists.find((artist) => artist.albumCount === 1)!;
    const multiView = buildArtistDiscoveryPresentation(multi.artistId)!;
    const singleView = buildArtistDiscoveryPresentation(single.artistId)!;
    expect(multiView.primary.target.artists.map((artist) => artist.id)).toContain(multi.artistId);
    expect(multiView.primary.explanationKey).not.toBe("discovery.artist.escape");
    expect(singleView.primary.target.artists.map((artist) => artist.id)).not.toContain(single.artistId);
    expect(singleView.primary.explanationKey).toBe("discovery.artist.escape");
    expect(singleView.primary.explanation).toMatch(/唯一作品/);
    expect(singleView.primary.explanation).not.toMatch(/相关艺人|相似艺人|合作|你可能|推荐/);
  });

  it("uses the most recent carried Album as an Artist chronology anchor", () => {
    const artist = publishedArtists.find((candidate) => candidate.albumCount > 1)!;
    const anchor = catalogAlbums.find((album) => artist.albumIds.includes(album.id))!;
    const query = `entry=album&entryKey=${anchor.slug}&trail=${anchor.slug}`;
    const view = buildArtistDiscoveryPresentationFromSearchParams(artist.artistId, query)!;
    expect(view.path).toMatchObject({
      active: true,
      entryLabel: anchor.title,
      previousAlbumTitle: anchor.title,
    });
    expect(view.primary.target.id).not.toBe(anchor.id);
    expect(view).toEqual(buildArtistDiscoveryPresentationFromSearchParams(artist.artistId, query));
  });
});

describe("R13-3D visible topic presentation", () => {
  it("adapts exactly the authorized 53 topic entities", () => {
    const topics = topicKinds.flatMap((kind) =>
      getTopicSummaries(kind).map((topic) => ({ kind, topic })));
    expect(topics).toHaveLength(53);
    for (const { kind, topic } of topics) {
      const presentation = buildTopicDiscoveryPresentation(kind, topic.key);
      expect(presentation).not.toBeNull();
      expect(presentation?.source.count).toBe(topic.count);
      expect(presentation?.primary.explanationKey).toBe("discovery.topic.to_album");
      expect(presentation?.primary.explanation).toContain(topic.label);
      expect(presentation?.alternates.length).toBeLessThanOrEqual(3);
      expect(JSON.stringify(presentation)).toBe(JSON.stringify(
        buildTopicDiscoveryPresentation(kind, topic.key),
      ));
    }
  }, 30_000);

  it("preserves a validated Album origin on deep link and refresh", () => {
    const topic = getTopicSummaries("core")[0];
    const source = catalogAlbums[0];
    const query = `entry=album&entryKey=${source.slug}&trail=${source.slug}`;
    const view = buildTopicDiscoveryPresentationFromSearchParams("core", topic.key, query)!;
    expect(view.path).toMatchObject({ active: true, entryLabel: source.title });
    expect(view).toEqual(buildTopicDiscoveryPresentationFromSearchParams("core", topic.key, query));
  });

  it("defers a recently visited Topic member when another truthful member exists", () => {
    const topic = getTopicSummaries("core").find((candidate) => candidate.count > 1)!;
    const source = catalogAlbums.find((album) => album.coreGenres.includes(topic.key))!;
    const query = `entry=album&entryKey=${source.slug}&trail=${source.slug}`;
    const view = buildTopicDiscoveryPresentationFromSearchParams("core", topic.key, query)!;
    expect(view.primary.target.slug).not.toBe(source.slug);
    expect(view.primary.explanationKey).toBe("discovery.topic.to_album");
    expect(view).toEqual(buildTopicDiscoveryPresentationFromSearchParams("core", topic.key, query));
  });

  it("keeps visible copy free of raw engine details and prohibited recommendation language", () => {
    const serialized = JSON.stringify([
      ...publishedArtists.map((artist) => buildArtistDiscoveryPresentation(artist.artistId)),
      ...topicKinds.flatMap((kind) => getTopicSummaries(kind)
        .map((topic) => buildTopicDiscoveryPresentation(kind, topic.key))),
    ]);
    expect(serialized).not.toMatch(/你可能会喜欢|猜你喜欢|为你推荐|热门|AI 推荐|相似艺人|candidatePool|rankKey|\d+%/);
    const visibleCopy = [
      ...publishedArtists.map((artist) => buildArtistDiscoveryPresentation(artist.artistId)),
      ...topicKinds.flatMap((kind) => getTopicSummaries(kind)
        .map((topic) => buildTopicDiscoveryPresentation(kind, topic.key))),
    ].flatMap((view) => view ? [view.primary, ...view.alternates] : [])
      .map((option) => `${option.lens} ${option.explanation}`).join(" ");
    expect(visibleCopy).not.toMatch(/SAME_|SHARED_|PRIMARY_|CONTEXT_|CLEAN_CHRONOLOGY|FALLBACK|SPECIFIC/);
  }, 30_000);
});

describe("R13-3D entity-hop URL contract", () => {
  it("preserves the prior origin, bounds the trail, and appends the current Album", () => {
    const href = buildDiscoveryEntityHref(
      "/artists/example",
      "blue-joni-mitchell",
      "entry=primary-genre&entryKey=rock&trail=rumours~loveless~ok-computer&via=SHARED_SECONDARY~PRIMARY_ONLY~PRIMARY_ADJACENT_ERA",
    );
    const query = new URL(href, "https://local.test").searchParams;
    expect(parseDiscoveryPathContext(query, publishedDiscoveryIndex)).toEqual({
      entryKind: "primary-genre",
      entryKey: "rock",
      trailAlbumSlugs: ["loveless", "ok-computer", "blue-joni-mitchell"],
      transitionFamilies: ["SHARED_SECONDARY", "PRIMARY_ONLY", "PRIMARY_ADJACENT_ERA"],
    });
  });
});
