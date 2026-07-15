import type { MockAlbum } from "@/data/albums.mock";

import { AlbumCard } from "./album-card";

type AlbumGridProps = {
  albums: MockAlbum[];
  layout?: "catalog" | "home";
};

export function AlbumGrid({ albums, layout = "catalog" }: AlbumGridProps) {
  return (
    <div
      className={layout === "home" ? "album-grid album-grid--home" : "album-grid"}
    >
      {albums.map((album) => (
        <AlbumCard album={album} key={album.id} />
      ))}
    </div>
  );
}
