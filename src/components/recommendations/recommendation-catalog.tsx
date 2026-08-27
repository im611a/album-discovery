"use client";

import { useState } from "react";
import { TasteSetup } from "@/components/taste/taste-setup";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";
import { PersonalJourneySurface } from "@/components/personalization/personal-journey-surface";

export function RecommendationCatalog() {
  const { state, hydrated } = usePersonalState();
  const [tasteOpen, setTasteOpen] = useState(false);
  if (!hydrated) return <p className="status-message">正在读取本机偏好…</p>;
  if (!state.onboardingCompleted) return <section className="ux-for-you-cold-start" aria-labelledby="taste-title"><TasteSetup embedded redirectTo={null} mode="cold-start" /></section>;
  return <>
    <PersonalJourneySurface context="FOR_YOU" source="for-you" eyebrow="WHAT TO HEAR NEXT / LOCAL ONLY" title="现在，先完整听这一张" className="r14-for-you-journey" limit={6} forYou onAdjustTaste={() => setTasteOpen(true)} />
    {tasteOpen ? <section id="for-you-taste-settings" className="ux-for-you-taste-settings" aria-labelledby="for-you-taste-settings-title">
      <header><div><p className="section-kicker">OPTIONAL / LOCAL ONLY</p><h2 id="for-you-taste-settings-title">调整口味</h2></div><button type="button" onClick={() => setTasteOpen(false)}>收起</button></header>
      <TasteSetup redirectTo={null} />
    </section> : null}
  </>;
}
