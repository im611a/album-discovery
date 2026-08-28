import { homepageContent } from "./homepage-data-adapter";
import { HomepageAlbumField } from "./homepage-album-field";
import { HomepageFixedInterface } from "./homepage-fixed-interface";
import { HomepageRuntimeClient } from "./homepage-runtime-client";
import { HomepageStage } from "./homepage-stage";
import { HomepageTransition } from "./homepage-transition";
import { PersonalJourneySurface } from "@/components/personalization/personal-journey-surface";
import { Suspense } from "react";
import { RecentReturnRail } from "@/components/home/recent-return-rail";

export function HomepageShell() {
  return (
    <HomepageRuntimeClient stageAlbums={homepageContent.stage}>
      <h1 className="ad-sr-only">专辑发现</h1>
      <HomepageFixedInterface />
      <main className="ad-work">
        <HomepageAlbumField albums={homepageContent.gallery} initialAlbumSlug="madvillainy" />
        <HomepageStage albums={homepageContent.stage} />
        <RecentReturnRail />
        <Suspense fallback={<section className="r14-personal-journey r14-personal-journey--neutral r14-home-journey" aria-busy="true"><p>正在读取当前设备上的个人线索…</p></section>}>
          <PersonalJourneySurface context="HOME" source="home" eyebrow="YOUR NEXT RECORD / LOCAL ONLY" title="从你的本机线索，再翻一张" className="r14-home-journey" limit={4} />
        </Suspense>
        <HomepageTransition />
      </main>
    </HomepageRuntimeClient>
  );
}
