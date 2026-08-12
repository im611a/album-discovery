"use client";

import { TasteSetup } from "@/components/taste/taste-setup";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";
import { PersonalJourneySurface } from "@/components/personalization/personal-journey-surface";

export function RecommendationCatalog() {
  const { state, hydrated } = usePersonalState();
  return <>
    <PersonalJourneySurface context="FOR_YOU" source="for-you" eyebrow="CURATED FROM THIS DEVICE" title="一组有来源的下一张" className="r14-for-you-journey" limit={10} />
    {hydrated && !state.onboardingCompleted ? <section className="r14-for-you-setup" aria-labelledby="r14-for-you-setup-title"><p className="section-kicker">可选的明确输入</p><h2 id="r14-for-you-setup-title">告诉本站你愿意从哪里开始</h2><p>设置口味只保存在当前设备；跳过也不会生成虚构结论。</p><TasteSetup /></section> : null}
  </>;
}
