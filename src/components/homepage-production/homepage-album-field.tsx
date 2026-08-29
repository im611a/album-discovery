"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { HomepageAlbum } from "./homepage-data-adapter";
import type { HomepageExperienceData } from "./homepage-experience-data";
import { HomepageChromaticDiscovery } from "./homepage-chromatic-discovery";
import { HomepageContinuation } from "./homepage-continuation";
import { HomepageGallery } from "./homepage-gallery";
import { HomepageAmbientFlowField } from "./homepage-ambient-flow-field";
import { HomepageVinylMarker } from "./homepage-vinyl-marker";

export function HomepageAlbumField({
  albums,
  initialAlbumSlug,
  experience,
  children,
}: {
  albums: readonly HomepageAlbum[];
  initialAlbumSlug: string;
  experience: HomepageExperienceData;
  children: ReactNode;
}) {
  const initialAlbum = albums.find((album) => album.slug === initialAlbumSlug);
  if (!initialAlbum) throw new Error(`首页初始黑胶专辑不存在：${initialAlbumSlug}`);

  const [selectedAlbumId, setSelectedAlbumId] = useState(initialAlbum.albumId);
  const selectedAlbum = useMemo(() => experience.albums[selectedAlbumId] ?? experience.albums[initialAlbum.albumId], [experience, initialAlbum.albumId, selectedAlbumId]);
  const atmosphereStyle = {
    "--ad-accent": selectedAlbum.accentColor,
    "--ad-accent-secondary": selectedAlbum.accentSecondaryColor,
  } as CSSProperties;

  return <div className="ad-experience" style={atmosphereStyle} data-selected-album={selectedAlbum.slug} data-atmosphere={selectedAlbum.primaryVisualColor}>
    <HomepageAmbientFlowField
      albumId={selectedAlbum.albumId}
      accentColor={selectedAlbum.accentColor}
      accentSecondaryColor={selectedAlbum.accentSecondaryColor}
    />
    <HomepageVinylMarker labelAlbum={selectedAlbum} />
    <div className="ad-gallery-spacer" />
    <HomepageGallery
      albums={albums}
      selectedAlbumId={selectedAlbum.albumId}
      onSelect={setSelectedAlbumId}
    />
    <HomepageChromaticDiscovery
      albums={experience.albums}
      chromaticAlbumIds={experience.chromaticAlbumIds}
      selectedAlbumId={selectedAlbum.albumId}
      onSelect={setSelectedAlbumId}
    />
    {children}
    <HomepageContinuation
      album={selectedAlbum}
      albums={experience.albums}
      options={experience.relationships[selectedAlbum.albumId] ?? []}
      onSelect={setSelectedAlbumId}
    />
  </div>;
}
