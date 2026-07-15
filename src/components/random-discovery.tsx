"use client";

import { useState } from "react";

import { AlbumCover } from "@/components/albums/album-cover";
import type { MockAlbum } from "@/data/albums.mock";
import { formatArtists } from "@/lib/albums";
import { getDisplayLabel } from "@/lib/display-labels";

type RandomDiscoveryProps = {
  albums: MockAlbum[];
};

export function RandomDiscovery({ albums }: RandomDiscoveryProps) {
  const [index, setIndex] = useState(0);
  const album = albums[index % albums.length];

  function showNextAlbum() {
    setIndex((current) => (current + 1) % albums.length);
  }

  return (
    <div className="random-discovery" aria-live="polite">
      <div className="random-discovery__cover">
        <AlbumCover album={album} />
      </div>
      <div className="random-discovery__content">
        <p className="eyebrow">本次发现</p>
        <h3>{album.title}</h3>
        <p className="random-discovery__artist">{formatArtists(album.artists)}</p>
        <div className="random-discovery__meta">
          <span>{album.releaseYear}</span>
          <span>{getDisplayLabel(album.releaseType)}</span>
          {album.rymScore !== null ? <span>RYM {album.rymScore.toFixed(2)}</span> : null}
        </div>
        <ul className="random-discovery__genres" aria-label="主流派">
          {album.primaryGenres.slice(0, 2).map((genre) => (
            <li key={genre}>{getDisplayLabel(genre)}</li>
          ))}
        </ul>
        <button className="secondary-button" onClick={showNextAlbum} type="button">
          换一张
        </button>
      </div>
    </div>
  );
}
