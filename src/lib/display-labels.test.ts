import { describe, expect, it } from "vitest";

import { albumsMock } from "@/data/albums.mock";

import { getDisplayLabel } from "./display-labels";

describe("display labels", () => {
  it("returns approved Chinese labels for known source values", () => {
    expect(getDisplayLabel("Art Pop")).toBe("艺术流行");
    expect(getDisplayLabel("Indie Rock")).toBe("独立摇滚");
    expect(getDisplayLabel("Soundtrack")).toBe("电影原声");
  });

  it("falls back to the original source label when no mapping exists", () => {
    expect(getDisplayLabel("Shoegaze")).toBe("Shoegaze");
  });

  it("covers every English taxonomy value used by the mock albums", () => {
    const taxonomyLabels = new Set(
      albumsMock.flatMap((album) => [
        ...album.primaryGenres,
        ...album.secondaryGenres,
        ...album.descriptors,
      ]),
    );

    for (const sourceLabel of taxonomyLabels) {
      if (/[a-z]/i.test(sourceLabel)) {
        expect(getDisplayLabel(sourceLabel)).not.toBe(sourceLabel);
      }
    }
  });
});
