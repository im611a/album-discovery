import { homepageContent } from "./homepage-data-adapter";
import { HomepageFixedInterface } from "./homepage-fixed-interface";
import { HomepageGallery } from "./homepage-gallery";
import { HomepageRuntimeClient } from "./homepage-runtime-client";
import { HomepageStage } from "./homepage-stage";
import { HomepageTransition } from "./homepage-transition";
import { HomepageVinylMarker } from "./homepage-vinyl-marker";

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
        <HomepageTransition />
      </main>
    </HomepageRuntimeClient>
  );
}
