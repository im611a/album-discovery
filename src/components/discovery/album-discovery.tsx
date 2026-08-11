"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildAlbumDiscoveryPresentationFromSearchParams,
  type AlbumDiscoveryPresentation,
} from "@/catalog/discovery/presentation";
import { AlbumDiscoveryView } from "./album-discovery-view";

export function AlbumDiscovery({
  sourceAlbumId,
  canonicalPresentation,
}: {
  sourceAlbumId: string;
  canonicalPresentation: AlbumDiscoveryPresentation;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const presentation = useMemo(
    () => query
      ? buildAlbumDiscoveryPresentationFromSearchParams(sourceAlbumId, query)
      : canonicalPresentation,
    [canonicalPresentation, query, sourceAlbumId],
  );
  return presentation ? <AlbumDiscoveryView presentation={presentation} /> : null;
}
