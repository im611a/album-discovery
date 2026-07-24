import { describe, expect, it } from "vitest";
import { classifyRymCandidate, matchAlbumToRym, normalizeIdentityText } from "./rym-matcher.mjs";

const album = {
  title: "The “Example”", aliases: ["示例专辑"], artists: [{ name: "Artist A" }, { name: "Artist B" }],
  releaseDate: "2020-01-01", albumType: "album",
};
const candidate = { title: "The Example", artist: "Artist A & Artist B", releaseYear: "2020", releaseType: "album" };

describe("RYM composite matcher", () => {
  it("normalizes punctuation, width and Unicode without dropping identity evidence", () => {
    expect(normalizeIdentityText("Ｔｈｅ “Example”")).toBe(normalizeIdentityText("The Example"));
  });

  it("matches title, complete collaborators, year and type exactly", () => {
    expect(classifyRymCandidate(album, candidate)?.status).toBe("MATCHED_EXACT");
  });

  it("identifies registered aliases separately", () => {
    expect(classifyRymCandidate(album, { ...candidate, title: "示例专辑" })?.status).toBe("MATCHED_ALIAS");
  });

  it("permits a controlled one-year strong match but rejects larger conflicts", () => {
    expect(classifyRymCandidate(album, { ...candidate, releaseYear: "2021" })?.status).toBe("MATCHED_STRONG");
    expect(classifyRymCandidate(album, { ...candidate, releaseYear: "2023" })?.status).toBe("REJECTED");
  });

  it("rejects release type conflicts and same-title different artists", () => {
    expect(classifyRymCandidate(album, { ...candidate, releaseType: "single" })?.status).toBe("REJECTED");
    expect(classifyRymCandidate(album, { ...candidate, artist: "Different Artist" })).toBeNull();
  });

  it("keeps multiple reliable candidates ambiguous", () => {
    expect(matchAlbumToRym(album, [candidate, { ...candidate, reference: "second" }]).status).toBe("AMBIGUOUS");
  });
});
