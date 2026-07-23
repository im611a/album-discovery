import { describe, expect, it } from "vitest";
import catalog from "../../src/data/generated/catalog.json" with { type: "json" };
import identities from "./netease-identities.json" with { type: "json" };

describe("fixed NetEase album identities", () => {
  it("maps the complete snapshot to unique numeric album IDs", () => {
    expect(Object.keys(identities)).toHaveLength(catalog.albums.length);
    const ids = Object.values(identities).map((identity) => identity.albumId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^\d+$/.test(id))).toBe(true);
    for (const album of catalog.albums) expect(identities[album.slug]?.albumId).toBe(album.neteaseAlbumId);
  });

  it.each(Object.entries(identities))("keeps %s fixed to its published NetEase album", (slug, identity) => {
    const album = catalog.albums.find((item) => item.slug === slug);
    expect(album).toBeDefined();
    expect(album?.neteaseAlbumId).toBe(identity.albumId);
    expect(album?.title.normalize("NFKC").toLocaleLowerCase("zh-CN")).toBe(identity.title.normalize("NFKC").toLocaleLowerCase("zh-CN"));
    expect(album?.artists.some((artist) => {
      const actual = artist.name.normalize("NFKC").toLocaleLowerCase("zh-CN");
      const expected = identity.artist.normalize("NFKC").toLocaleLowerCase("zh-CN");
      return actual.includes(expected) || expected.includes(actual);
    })).toBe(true);
  });

  it("fixes the two required Chinese albums to reviewed identities", () => {
    expect(identities["wake-after-the-rain"]).toMatchObject({ albumId: "287974232", title: "在雨后醒来", artist: "艾志恒Asen" });
    expect(identities["super-mr-sun"]).toMatchObject({ albumId: "286248593", title: "超级孙先生", artist: "SASIOVERLXRD" });
  });
});
