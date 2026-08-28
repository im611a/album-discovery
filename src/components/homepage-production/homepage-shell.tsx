import { homepageContent } from "./homepage-data-adapter";
import { HomepageAlbumField } from "./homepage-album-field";
import { HomepageFixedInterface } from "./homepage-fixed-interface";
import { HomepageRuntimeClient } from "./homepage-runtime-client";
import { HomepageStage } from "./homepage-stage";
import { HomepageTransition } from "./homepage-transition";
import { RecentReturnRail } from "@/components/home/recent-return-rail";
import { buildAlbumDiscoveryPresentation } from "@/catalog/discovery/presentation";

export function HomepageShell() {
  const continuations = Object.fromEntries(homepageContent.gallery.map((album) => [album.albumId, buildAlbumDiscoveryPresentation(album.albumId)]));
  return (
    <HomepageRuntimeClient stageAlbums={homepageContent.stage}>
      <h1 className="ad-sr-only">专辑发现</h1>
      <HomepageFixedInterface />
      <main className="ad-work">
        <HomepageAlbumField albums={homepageContent.gallery} initialAlbumSlug="madvillainy" continuations={continuations}>
          <HomepageStage albums={homepageContent.stage} />
          <RecentReturnRail />
        </HomepageAlbumField>
        <HomepageTransition />
      </main>
    </HomepageRuntimeClient>
  );
}
