"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { TopicKind } from "@/catalog/topics";
import {
  buildTopicDiscoveryPresentationFromSearchParams,
  type TopicDiscoveryPresentation,
} from "@/catalog/discovery/artist-topic-presentation";
import { EntityDiscoveryView } from "./entity-discovery-view";

export function TopicDiscovery({
  kind,
  topicKey,
  canonicalPresentation,
}: {
  kind: TopicKind;
  topicKey: string;
  canonicalPresentation: TopicDiscoveryPresentation;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const presentation = useMemo(
    () => query
      ? buildTopicDiscoveryPresentationFromSearchParams(kind, topicKey, query)
      : canonicalPresentation,
    [canonicalPresentation, kind, query, topicKey],
  );
  return presentation ? <EntityDiscoveryView presentation={presentation} /> : null;
}
