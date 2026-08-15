import { describe, expect, it } from "vitest";
import { catalogAlbums, publishedArtists } from "./published-catalog";
import { appendArtistReturnContext } from "./artist-return-context";
import { buildRecentReturnContext } from "./recent-return-navigation";

describe("R17 return provenance", () => {
  it.each([
    ["lfrom=library&lview=recent", "LIBRARY_RECENT", "/library?view=recent"],
    ["lfrom=library&lview=favorite", "LIBRARY_COLLECTION", "/library?view=favorite"],
    ["sfrom=search&sq=ambient&spage=2", "SEARCH_RESULT", "/search?q=ambient&page=2"],
    ["pfrom=home", "HOME", "/"],
    ["pfrom=for-you", "FOR_YOU", "/for-you"],
    ["pfrom=explore&entry=explore", "EXPLORE_PERSONAL", "/explore?mode=personal"],
    ["entry=explore", "EXPLORE", "/explore"],
  ])("maps %s to a truthful bounded return", (query, origin, href) => {
    expect(buildRecentReturnContext(query, catalogAlbums)).toMatchObject({ origin, href });
  });

  it("maps canonical artist entries and rejects stale or fabricated origins", () => {
    const artist = publishedArtists[0];
    expect(buildRecentReturnContext(`entry=artist&entryKey=${artist.slug}`, catalogAlbums)).toMatchObject({
      origin: "ARTIST_DISCOGRAPHY", href: `/artists/${artist.slug}`,
    });
    expect(buildRecentReturnContext(`pfrom=artist&entry=artist&entryKey=${artist.slug}`, catalogAlbums)).toMatchObject({
      origin: "ARTIST_PERSONAL_CONTINUATION", href: `/artists/${artist.slug}`,
    });
    expect(buildRecentReturnContext("entry=artist&entryKey=missing", catalogAlbums)).toBeNull();
    expect(buildRecentReturnContext("lfrom=library&sfrom=search", catalogAlbums)).toBeNull();
    expect(buildRecentReturnContext("pfrom=album", catalogAlbums)).toBeNull();
    expect(buildRecentReturnContext("", catalogAlbums)).toBeNull();
    const layered = appendArtistReturnContext("/albums/example?entry=explore&lfrom=library&lview=recent", artist.slug);
    expect(layered).toContain("entry=explore");
    expect(layered).toContain("lfrom=library");
    expect(buildRecentReturnContext(layered.split("?")[1], catalogAlbums)).toMatchObject({ origin: "ARTIST_DISCOGRAPHY", href: `/artists/${artist.slug}` });
  });

  it("keeps return URLs bounded under malformed input", () => {
    const result = buildRecentReturnContext(`sfrom=search&sq=${"x".repeat(10_000)}&spage=999999`, catalogAlbums);
    expect(result?.href.length).toBeLessThan(160);
    expect(result?.href).toBe("/search?q=" + "x".repeat(100));
  });
});
