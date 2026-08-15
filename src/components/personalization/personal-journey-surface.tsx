"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { buildPersonalJourneyPresentation, type PersonalizationContext, type PersonalJourneySource } from "@/catalog/personalization";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";
import { PersonalJourneySection } from "./personal-journey-section";

export function PersonalJourneySurface({ context, source, title, eyebrow, className, currentAlbumSlug, originArtistSlug, currentAlbumIds, eligibleAlbumIds, relationFallbackAlbumIds, limit = 8 }: {
  context: PersonalizationContext;
  source: PersonalJourneySource;
  title: string;
  eyebrow: string;
  className?: string;
  currentAlbumSlug?: string;
  originArtistSlug?: string;
  currentAlbumIds?: readonly string[];
  eligibleAlbumIds?: readonly string[];
  relationFallbackAlbumIds?: readonly string[];
  limit?: number;
}) {
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? "";
  const { state, hydrated } = usePersonalState();
  const presentation = useMemo(() => hydrated ? buildPersonalJourneyPresentation({
    state, context, source, limit, searchParams: query, currentAlbumSlug, originArtistSlug,
    currentAlbumIds, eligibleAlbumIds, relationFallbackAlbumIds,
  }) : null, [context, currentAlbumIds, currentAlbumSlug, eligibleAlbumIds, hydrated, limit, originArtistSlug, query, relationFallbackAlbumIds, source, state]);
  if (!presentation) return <section className={`r14-personal-journey r14-personal-journey--neutral ${className ?? ""}`.trim()} aria-busy="true" aria-label={`${title}正在读取`}><p>正在读取当前设备上的个人线索…</p></section>;
  return <PersonalJourneySection presentation={presentation} title={title} eyebrow={eyebrow} className={className} />;
}
