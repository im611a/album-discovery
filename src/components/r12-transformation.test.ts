import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("R12 reference-driven structural transformation", () => {
  it("puts real catalog results before the advanced document-flow filters", () => {
    const discover = source("src/components/discover/discover-catalog.tsx");
    expect(discover).toContain("r12-catalog-toolbar__status");
    expect(discover.indexOf("model.resultCount")).toBeLessThan(discover.indexOf("<DiscoverFilterFields query"));
    expect(discover).toContain("catalog-advanced-filters");
    expect(discover).not.toContain('role="dialog"');
  });

  it("uses one flat detail cover and numbered object-file sections", () => {
    const detail = source("src/components/albums/album-detail.tsx");
    const discovery = source("src/components/discovery/album-discovery-view.tsx");
    const structure = `${detail}\n${discovery}`;
    expect(detail).toContain('<AlbumCover album={album} size="detail" />');
    for (const number of ["01", "02", "03", "04", "05A", "05B", "06"]) {
      expect(structure).toContain(number);
    }
    expect(detail).not.toContain("pa-same-artist-shelf__spine");
    expect(detail).not.toContain("RecordPackage");
  });

  it("turns creators and intake records into archive structures", () => {
    const directory = source("src/components/artists/artist-directory.tsx");
    const artist = source("src/app/artists/[slug]/page.tsx");
    const intake = source("src/components/new-releases/new-releases-catalog.tsx");
    expect(directory).toContain("r12-artist-index__group");
    expect(artist).toContain("r12-discography__timeline");
    expect(artist).toContain("chronology");
    expect(intake).toContain("archiveGroups");
    expect(intake).toContain("ArchiveAlbumRow");
    expect(intake).toContain('data-archive-basis');
  });

  it("keeps topic density explicit and removes the obsolete Explore breadcrumb", () => {
    const index = source("src/components/topics/topic-index.tsx");
    const topic = source("src/components/topics/topic-page.tsx");
    expect(index).toContain('data-density={topic.count === 1 ? "sparse"');
    expect(index).toContain("data-topic-position");
    expect(topic).not.toContain('href="/explore"');
  });

  it("routes the recommendation surface through the R14 evidence-backed presentation", () => {
    const recommendation = source("src/components/recommendations/recommendation-catalog.tsx");
    expect(recommendation).toContain("PersonalJourneySurface");
    expect(recommendation).toContain('context="FOR_YOU"');
    expect(recommendation).toContain("!state.onboardingCompleted");
  });

  it("defines the neutral ink system and responsive catalog densities", () => {
    const css = source("src/app/globals.css");
    for (const token of ["--r12-ink", "--r12-graphite", "--r12-paper", "--r12-rule"]) {
      expect(css).toContain(token);
    }
    for (const columns of ["repeat(8", "repeat(6", "repeat(5", "repeat(4", "repeat(3", "repeat(2"]) {
      expect(css).toContain(columns);
    }
    expect(css).toContain("R12 reference-driven product transformation");
  });
});
