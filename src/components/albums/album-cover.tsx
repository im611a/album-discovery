import type { CSSProperties } from "react";

import type { MockAlbum } from "@/data/albums.mock";

type AlbumCoverProps = {
  album: Pick<MockAlbum, "cover" | "id" | "title">;
};

export function AlbumCover({ album }: AlbumCoverProps) {
  const { background, foreground, accent, motif } = album.cover;

  return (
    <div
      aria-label={`${album.title} 的虚构专辑封面`}
      className={`mock-cover mock-cover--${motif}`}
      role="img"
      style={
        {
          "--cover-background": background,
          "--cover-foreground": foreground,
          "--cover-accent": accent,
        } as CSSProperties
      }
    >
      <span className="mock-cover__shape" aria-hidden="true" />
      <span className="mock-cover__index" aria-hidden="true">
        {album.id.slice(-3)}
      </span>
    </div>
  );
}
