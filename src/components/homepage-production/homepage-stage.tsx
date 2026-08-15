import Link from "next/link";
import type { HomepageStageAlbum } from "./homepage-data-adapter";

export function HomepageStage({ albums }: { albums: readonly HomepageStageAlbum[] }) {
  const first = albums[0];
  return (
    <section className="ad-stage" aria-label="专辑舞台" data-stage-count={albums.length}>
      <div className="ad-stage__pin">
        <canvas id="homepageStageCanvas" className="ad-stage__canvas" aria-hidden="true" />
        <Link
          id="homepageStageTitle"
          className="ad-stage__title"
          href={`/albums/${first.slug}/?pfrom=home`}
          data-album-id={first.albumId}
        >
          {first.artists.join("、")} – {first.title}
        </Link>
        <p className="ad-stage__meta">
          <span id="homepageStageNumber">{first.displayNumber ?? "/01"}</span>
        </p>
      </div>
    </section>
  );
}
