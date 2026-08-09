import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TopicSummary } from "@/catalog/topics";
import type { PublishedTrack } from "@/catalog/schema";
import { TrackList } from "@/components/albums/track-list";
import { PageHeader } from "@/components/site-primitives";
import { TopicIndex } from "@/components/topics/topic-index";

const tracks: PublishedTrack[] = [
  { id: "track-1", neteaseTrackId: "1", title: "主艺人曲目", trackNumber: 1, discNumber: 1, artists: ["档案艺人"], durationMs: 183_000 },
  { id: "track-2", neteaseTrackId: "2", title: "合作曲目", trackNumber: 2, discNumber: 1, artists: ["档案艺人", "客席艺人"], durationMs: 205_000 },
];

describe("R11-B shared convergence contracts", () => {
  it("marks page headers with a semantic family without changing heading structure", () => {
    const { container } = render(<PageHeader eyebrow="本地检索" title="搜索" family="utility">输入关键词。</PageHeader>);
    expect(container.firstChild).toHaveAttribute("data-page-family", "utility");
    expect(screen.getByRole("heading", { level: 1, name: "搜索" })).toBeInTheDocument();
  });

  it("marks topic cards from real counts as sparse, medium, or dense", () => {
    const topics: TopicSummary[] = [
      { kind: "decade", key: "1950s", slug: "1950s", label: "1950 年代", count: 1, previewAlbums: [], commonCoreGenres: [] },
      { kind: "decade", key: "1970s", slug: "1970s", label: "1970 年代", count: 3, previewAlbums: [], commonCoreGenres: [] },
      { kind: "decade", key: "2000s", slug: "2000s", label: "2000 年代", count: 20, previewAlbums: [], commonCoreGenres: [] },
    ];
    const { container } = render(<TopicIndex topics={topics} />);
    expect(container.querySelector('[data-density="sparse"]')).toHaveTextContent("1950 年代");
    expect(container.querySelector('[data-density="medium"]')).toHaveTextContent("1970 年代");
    expect(container.querySelector('[data-density="dense"]')).toHaveTextContent("2000 年代");
  });

  it("hides repeated album artists but keeps a real guest performer", () => {
    render(<TrackList tracks={tracks} albumArtists={["档案艺人"]} />);
    expect(within(screen.getByText("主艺人曲目").parentElement as HTMLElement).queryByText("档案艺人")).not.toBeInTheDocument();
    expect(within(screen.getByText("合作曲目").parentElement as HTMLElement).getByText("档案艺人、客席艺人")).toBeInTheDocument();
  });
});
