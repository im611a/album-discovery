"use client";

import { useEffect } from "react";
import type { PublishedAlbum } from "@/catalog/schema";
import { AlbumActions } from "@/components/album-actions";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

export function AlbumDetailActions({ album }: { album: PublishedAlbum }) {
  const { recordRecent } = usePersonalState();
  useEffect(() => recordRecent(album.id), [album.id, recordRecent]);
  return <AlbumActions album={album} />;
}
