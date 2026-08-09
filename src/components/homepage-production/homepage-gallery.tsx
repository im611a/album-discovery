import type { CSSProperties } from "react";
import Link from "next/link";
import type { HomepageAlbum } from "./homepage-data-adapter";
import { getHomepageGalleryGeometry } from "./homepage-geometry";

export function HomepageGallery({ albums }: { albums: readonly HomepageAlbum[] }) {
  return (
    <section id="homepage-gallery" className="ad-gallery" aria-label="专辑画廊">
      {albums.map((album, index) => {
        const desktop = getHomepageGalleryGeometry(index, 1440, albums.length);
        const mobile = getHomepageGalleryGeometry(index, 390, albums.length);
        return (
          <figure
            className={`ad-poster ad-poster--${desktop.size}`}
            data-gallery-index={index + 1}
            data-album-id={album.albumId}
            key={album.albumId}
            style={{
              "--desktop-column": desktop.gridColumn,
              "--desktop-row": desktop.gridRow,
              "--desktop-transform": desktop.transform,
              "--desktop-square-scale": desktop.squareMediaScale,
              "--mobile-column": mobile.gridColumn,
              "--mobile-row": mobile.gridRow,
              "--mobile-margin-left": mobile.marginLeft ?? "0",
              "--mobile-transform": mobile.transform ?? "none",
              "--mobile-square-scale": mobile.squareMediaScale,
            } as CSSProperties}
          >
            <div className="ad-poster__frame">
              <div className="ad-poster__par">
                <div className="ad-poster__pointer">
                  <Link href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》专辑详情`}>
                    {/* A native image preserves the verified runtime geometry and static-export behavior. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={album.cover} alt={`${album.title} — ${album.artists.join("、")}`} loading="eager" />
                  </Link>
                </div>
              </div>
            </div>
          </figure>
        );
      })}
    </section>
  );
}
