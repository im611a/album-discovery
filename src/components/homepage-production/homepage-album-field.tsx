"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { HomepageAlbum } from "./homepage-data-adapter";
import type { AlbumDiscoveryPresentation } from "@/catalog/discovery/presentation";
import { HomepageContinuation } from "./homepage-continuation";
import { HomepageGallery } from "./homepage-gallery";
import { HomepageVinylMarker } from "./homepage-vinyl-marker";

export function HomepageAlbumField({
  albums,
  initialAlbumSlug,
  continuations,
  children,
}: {
  albums: readonly HomepageAlbum[];
  initialAlbumSlug: string;
  continuations: Readonly<Record<string, AlbumDiscoveryPresentation | null>>;
  children: ReactNode;
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
    {children}
    <HomepageContinuation album={selectedAlbum} presentation={continuations[selectedAlbum.albumId] ?? null} />
  </>;
}
