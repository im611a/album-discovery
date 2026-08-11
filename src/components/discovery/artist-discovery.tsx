"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildArtistDiscoveryPresentationFromSearchParams,
  type ArtistDiscoveryPresentation,
} from "@/catalog/discovery/artist-topic-presentation";
import { EntityDiscoveryView } from "./entity-discovery-view";

export function ArtistDiscovery({
  artistId,
  canonicalPresentation,
}: {
  artistId: string;
  canonicalPresentation: ArtistDiscoveryPresentation;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const presentation = useMemo(
    () => query
      ? buildArtistDiscoveryPresentationFromSearchParams(artistId, query)
      : canonicalPresentation,
    [artistId, canonicalPresentation, query],
  );
  return presentation ? <EntityDiscoveryView presentation={presentation} /> : null;
}
