import type { MockAlbum } from "@/data/albums.mock";
import { formatArtists } from "@/lib/albums";
import { getDisplayLabel } from "@/lib/display-labels";

import { MockAlbumCover } from "./mock-album-cover";

type AlbumCardProps = {
  album: MockAlbum;
};

export function AlbumCard({ album }: AlbumCardProps) {
  const visibleGenres = album.primaryGenres.slice(0, 2);

  return (
    <article className="album-card" tabIndex={0}>
      <MockAlbumCover album={album} />
      <div className="album-card__body">
        <h3 className="album-card__title" title={album.title}>
          {album.title}
        </h3>
        <p className="album-card__artist" title={formatArtists(album.artists)}>
          {formatArtists(album.artists)}
        </p>
        <div className="album-card__facts">
          <span>{album.releaseYear}</span>
          {album.rymScore !== null ? (
            <span aria-label={`RYM 评分 ${album.rymScore.toFixed(2)}`}>
              RYM {album.rymScore.toFixed(2)}
            </span>
          ) : null}
        </div>
        <ul className="album-card__genres" aria-label="主流派">
          {visibleGenres.map((genre) => (
            <li key={genre}>{getDisplayLabel(genre)}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
