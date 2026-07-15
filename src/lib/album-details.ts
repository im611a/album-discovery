import type { MockAlbum } from "@/data/albums.mock";
import { albumsMock } from "@/data/albums.mock";
import {
  albumDetailsMock,
  type MockAlbumDetail,
  type MockTrack,
} from "@/data/album-details.mock";
import { buildDiscoverOptions } from "@/lib/album-filters";

export type AlbumDetailView = {
  album: MockAlbum;
  detail: MockAlbumDetail;
};

export type TaxonomyKind =
  | "primaryGenre"
  | "secondaryGenre"
  | "descriptor";

export type TrackDisc = {
  discNumber: number;
  tracks: MockTrack[];
};

const detailsByAlbumId = new Map(
  albumDetailsMock.map((detail) => [detail.albumId, detail] as const),
);
const discoverOptions = buildDiscoverOptions(albumsMock);

const taxonomyConfig = {
  primaryGenre: {
    options: discoverOptions.primaryGenres,
    queryKey: "primaryGenre",
  },
  secondaryGenre: {
    options: discoverOptions.secondaryGenres,
    queryKey: "secondaryGenre",
  },
  descriptor: {
    options: discoverOptions.descriptors,
    queryKey: "descriptor",
  },
} as const;

export function getAlbumDetailBySlug(slug: string): AlbumDetailView | null {
  const album = albumsMock.find((candidate) => candidate.slug === slug);
  if (!album) return null;

  const detail = detailsByAlbumId.get(album.id);
  return detail ? { album, detail } : null;
}

export function getAlbumDetailById(albumId: string): AlbumDetailView | null {
  const album = albumsMock.find((candidate) => candidate.id === albumId);
  if (!album) return null;

  const detail = detailsByAlbumId.get(albumId);
  return detail ? { album, detail } : null;
}

export function groupTracksByDisc(tracks: MockTrack[]): TrackDisc[] {
  const sortedTracks = [...tracks].sort(
    (a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber,
  );
  const groups = new Map<number, MockTrack[]>();

  for (const track of sortedTracks) {
    const group = groups.get(track.discNumber) ?? [];
    group.push(track);
    groups.set(track.discNumber, group);
  }

  return [...groups].map(([discNumber, discTracks]) => ({
    discNumber,
    tracks: discTracks,
  }));
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatReleaseDate(releaseDate: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${releaseDate}T00:00:00.000Z`));
}

export function formatRatingCount(ratingCount: number) {
  return new Intl.NumberFormat("zh-CN").format(ratingCount);
}

export function getDiscoverTaxonomyHref(
  kind: TaxonomyKind,
  sourceLabel: string,
) {
  const config = taxonomyConfig[kind];
  const value = config.options.find((option) => option.label === sourceLabel)?.value;

  if (!value) return "/discover";

  const search = new URLSearchParams({ [config.queryKey]: value });
  return `/discover?${search.toString()}`;
}

export function shouldShowTrackArtists(
  trackArtists: string[],
  albumArtists: string[],
) {
  return (
    trackArtists.length > 1 ||
    trackArtists.length !== albumArtists.length ||
    trackArtists.some((artist, index) => artist !== albumArtists[index])
  );
}
