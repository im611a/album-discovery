import { homepageContent } from "./homepage-data-adapter";
import { HomepageFixedInterface } from "./homepage-fixed-interface";
import { HomepageGallery } from "./homepage-gallery";
import { HomepageRuntimeClient } from "./homepage-runtime-client";
import { HomepageStage } from "./homepage-stage";
import { HomepageTransition } from "./homepage-transition";
import { HomepageVinylMarker } from "./homepage-vinyl-marker";
import { PersonalJourneySurface } from "@/components/personalization/personal-journey-surface";
import { Suspense } from "react";

export function HomepageShell() {
  return (
    <HomepageRuntimeClient stageAlbums={homepageContent.stage}>
      <h1 className="ad-sr-only">专辑发现</h1>
      <HomepageFixedInterface />
      <main className="ad-work">
        <HomepageVinylMarker />
        <div className="ad-gallery-spacer" />
        <HomepageGallery albums={homepageContent.gallery} />
        <HomepageStage albums={homepageContent.stage} />
        <Suspense fallback={<section className="r14-personal-journey r14-personal-journey--neutral r14-home-journey" aria-busy="true"><p>正在读取当前设备上的个人线索…</p></section>}>
          <PersonalJourneySurface context="HOME" source="home" eyebrow="YOUR NEXT RECORD / LOCAL ONLY" title="从你的本机线索，再翻一张" className="r14-home-journey" limit={4} />
        </Suspense>
        <HomepageTransition />
      </main>
    </HomepageRuntimeClient>
  );
}
