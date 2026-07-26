import Link from "next/link";
import { AlbumCover } from "@/components/albums/album-cover";
import {
  formatPartialDate,
  RELEASE_TYPE_LABELS,
  type PublishedAlbum,
} from "@/catalog/schema";

function durationLabel(durationMs: number | null) {
  if (durationMs == null) return "";
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RecordPackage({
  album,
  expanded = false,
  detailHref = `/albums/${album.slug}`,
}: {
  album: PublishedAlbum;
  expanded?: boolean;
  detailHref?: string;
}) {
  const artistNames = album.artists.map((artist) => artist.name).join("、");

  return (
    <div className="record-package" data-record-package data-expanded={expanded}>
      <span className="record-package__contact-shadow" aria-hidden="true" />
      <div className="record-package__object">
        <div className="record-package__back" aria-hidden="true">
          <strong>{album.title}</strong>
          <span>{artistNames}</span>
        </div>
        <span className="record-package__spine" aria-hidden="true">
          {album.title} · {artistNames}
        </span>
        <span className="record-package__top" aria-hidden="true" />
        <span className="record-package__bottom" aria-hidden="true" />
        <div className="record-package__contents" aria-hidden="true">
          <div className="record-package__inner-sleeve">
            <span>{album.trackCount} TRACKS</span>
          </div>
          <div className="record-package__vinyl">
            <span className="record-package__grooves" />
            <span className="record-package__label">
              <small>ALBUM DISCOVERY</small>
              <strong>{album.title}</strong>
              <i />
            </span>
          </div>
          <div className="record-package__track-sheet">
            <small>ARCHIVE EDITION</small>
            <strong>{album.neteaseAlbumId}</strong>
            <span>
              {formatPartialDate(album.releaseDate, album.releaseDatePrecision)}
              {" · "}
              {RELEASE_TYPE_LABELS[album.albumType]}
            </span>
            <ol>
              {album.tracks.slice(0, 5).map((track) => (
                <li key={track.id}>
                  <span>{String(track.trackNumber).padStart(2, "0")} {track.title}</span>
                  <time>{durationLabel(track.durationMs)}</time>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <Link
          className="record-package__front"
          href={detailHref}
          aria-label={`查看《${album.title}》专辑详情`}
        >
          <AlbumCover album={album} size="detail" />
          <span className="record-package__gloss" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
