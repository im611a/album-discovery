import type { CSSProperties } from "react";
import type { HomepageAlbum } from "./homepage-data-adapter";
import { getHomepageGalleryGeometry } from "./homepage-geometry";

export function HomepageGallery({
  albums,
  selectedAlbumId,
  onSelect,
}: {
  albums: readonly HomepageAlbum[];
  selectedAlbumId: string;
  onSelect: (albumId: string) => void;
}) {
  return (
    <section id="homepage-gallery" className="ad-gallery" aria-label="专辑画廊">
      {albums.map((album, index) => {
        const desktop = getHomepageGalleryGeometry(index, 1440, albums.length);
        const mobile = getHomepageGalleryGeometry(index, 390, albums.length);
        return (
          <figure
            className={`ad-poster ad-poster--${desktop.size}${selectedAlbumId === album.albumId ? " is-selected" : ""}`}
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
                  <button
                    type="button"
                    aria-label={`选择《${album.title}》作为黑胶标签`}
                    aria-pressed={selectedAlbumId === album.albumId}
                    onClick={() => onSelect(album.albumId)}
                  >
                    {/* A native image preserves the verified runtime geometry and static-export behavior. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={album.cover} alt={`${album.title} — ${album.artists.join("、")}`} loading="eager" />
                  </button>
                </div>
              </div>
            </div>
          </figure>
        );
      })}
    </section>
  );
}
