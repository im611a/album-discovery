"use client";

import { useMemo, useState } from "react";
import type { HomepageAlbum } from "./homepage-data-adapter";
import { HomepageGallery } from "./homepage-gallery";
import { HomepageVinylMarker } from "./homepage-vinyl-marker";

export function HomepageAlbumField({
  albums,
  initialAlbumSlug,
}: {
  albums: readonly HomepageAlbum[];
  initialAlbumSlug: string;
}) {
  const initialAlbum = albums.find((album) => album.slug === initialAlbumSlug);
  if (!initialAlbum) throw new Error(`首页初始黑胶专辑不存在：${initialAlbumSlug}`);

  const [selectedAlbumId, setSelectedAlbumId] = useState(initialAlbum.albumId);
  const selectedAlbum = useMemo(
    () => albums.find((album) => album.albumId === selectedAlbumId) ?? initialAlbum,
    [albums, initialAlbum, selectedAlbumId],
  );

  return <>
    <HomepageVinylMarker labelAlbum={selectedAlbum} />
    <div className="ad-gallery-spacer" />
    <HomepageGallery
      albums={albums}
      selectedAlbumId={selectedAlbum.albumId}
      onSelect={setSelectedAlbumId}
    />
  </>;
}
