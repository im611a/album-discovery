import { describe, expect, it } from "vitest";
import { catalogAlbums } from "./published-catalog";
import { getListeningSceneLabel, LISTENING_SCENES } from "./listening-scenes";

describe("listening scene curation", () => {
  it("uses only the stable editorial scene vocabulary", () => {
    const valid = new Set(LISTENING_SCENES.map(([key]) => key));
    for (const album of catalogAlbums) {
      expect(album.contexts.length).toBeLessThanOrEqual(3);
      expect(album.contexts.every((key) => valid.has(key as never))).toBe(true);
    }
  });

  it("keeps labels natural in Chinese and separate from taxonomy", () => {
    expect(getListeningSceneLabel("focus")).toBe("学习与专注");
    expect(getListeningSceneLabel("night")).toBe("夜间");
    expect(catalogAlbums.flatMap((album) => album.contexts)).not.toContain("反复聆听");
  });
});
