import Link from "next/link";
import type { CSSProperties } from "react";
import type { HomepageStageAlbum } from "./homepage-data-adapter";
import type { HomepageExperienceData } from "./homepage-experience-data";
import { getHomepageAmbientPaintColor } from "./homepage-atmosphere-color";

export interface HomepageStageAtmosphereAlbum extends HomepageStageAlbum {
  stageFlowAccentColor: string;
  stageFlowAccentSecondaryColor: string;
}

export function buildHomepageStageAtmosphereAlbums(
  albums: readonly HomepageStageAlbum[],
  experience: HomepageExperienceData,
) {
  return albums.map((album) => {
    const visual = experience.albums[album.albumId];
    if (!visual) throw new Error(`首页舞台缺少色彩证据：${album.albumId}`);
    return {
      ...album,
      stageFlowAccentColor: getHomepageAmbientPaintColor(visual.accentColor),
      stageFlowAccentSecondaryColor: getHomepageAmbientPaintColor(visual.accentSecondaryColor),
    } satisfies HomepageStageAtmosphereAlbum;
  });
}

export function HomepageStage({ albums }: { albums: readonly HomepageStageAtmosphereAlbum[] }) {
  const first = albums[0];
  const stageStyle = {
    "--ad-stage-flow-accent": first.stageFlowAccentColor,
    "--ad-stage-flow-accent-secondary": first.stageFlowAccentSecondaryColor,
  } as CSSProperties;
  return (
    <section
      className="ad-stage"
      aria-label="专辑舞台"
      data-stage-count={albums.length}
      data-stage-ambient-album-id={first.albumId}
      style={stageStyle}
    >
      <div className="ad-stage__pin">
        <div
          className="ad-stage__flow"
          aria-hidden="true"
          data-stage-flow="camera-active-album"
          data-stage-ambient-album-id={first.albumId}
          data-stage-flow-accent={first.stageFlowAccentColor}
          data-stage-flow-accent-secondary={first.stageFlowAccentSecondaryColor}
        />
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
