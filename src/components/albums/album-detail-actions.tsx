"use client";

import { useEffect } from "react";
import type { PublishedAlbum } from "@/catalog/schema";
import { AlbumActions } from "@/components/album-actions";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function AlbumDetailActions({ album }: { album: PublishedAlbum }) {
  const { hydrated, recordRecent } = usePersonalState();
  useEffect(() => {
    if (hydrated) recordRecent(album.id);
  }, [album.id, hydrated, recordRecent]);
  return <AlbumActions album={album} />;
}
