import type { MockAlbum } from "@/data/albums.mock";

import { AlbumCard } from "./album-card";

type AlbumGridProps = {
  albums: MockAlbum[];
};

export function AlbumGrid({ albums }: AlbumGridProps) {
  return (
    <div className="album-grid">
      {albums.map((album) => (
        <AlbumCard album={album} key={album.id} />
      ))}
    </div>
  );
}
