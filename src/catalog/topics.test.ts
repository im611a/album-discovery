import { describe, expect, it } from "vitest";
import { catalogAlbums } from "./published-catalog";
import { deterministicTopicAlbum, getTopicAlbums, getTopicSummaries } from "./topics";

describe("topic hubs", () => {
  it("only generates non-empty topic routes from real catalog values", () => {
    const core = getTopicSummaries("core");
    const related = getTopicSummaries("related");
    const scenes = getTopicSummaries("scene");
    const decades = getTopicSummaries("decade");
    expect(core).toHaveLength(15);
    expect(related).toHaveLength(24);
    expect(scenes).toHaveLength(7);
    expect(decades.every((topic) => topic.count > 0)).toBe(true);
    expect([...core, ...related, ...scenes, ...decades].every((topic) => topic.count === getTopicAlbums(topic.kind, topic.key).length)).toBe(true);
  });
  it("does not derive related genres from core genres", () => {
    const relatedKeys = new Set(catalogAlbums.flatMap((album) => album.relatedGenres));
    expect(getTopicSummaries("related").map((topic) => topic.key).sort()).toEqual([...relatedKeys].sort());
  });
  it("returns a stable random album for the same topic seed", () => {
    const albums = getTopicAlbums("core", "pop");
    expect(deterministicTopicAlbum(albums, "pop:fixed")?.id).toBe(deterministicTopicAlbum(albums, "pop:fixed")?.id);
  });
});
