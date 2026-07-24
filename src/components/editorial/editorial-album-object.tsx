import type { CSSProperties } from "react";
import Link from "next/link";
import { AlbumActions } from "@/components/album-actions";
import { AlbumCover } from "@/components/albums/album-cover";
import type { PublishedAlbumSummary } from "@/catalog/schema";
import type { EditorialAlbumSlot } from "@/config/editorial-home";

type EditorialStyle = CSSProperties & {
  "--editorial-column": string;
  "--editorial-row": string;
};

export function EditorialAlbumObject({
  album,
  slot,
  opening = false,
}: {
  album: PublishedAlbumSummary;
  slot: EditorialAlbumSlot;
  opening?: boolean;
}) {
  const year = album.releaseYear ?? album.releaseDate?.slice(0, 4) ?? "日期暂缺";
  return <article
    className="editorial-album-object"
    data-size={slot.size}
    data-treatment={slot.treatment}
    data-desktop-visible={slot.desktopVisible}
    data-tablet-visible={slot.tabletVisible}
    data-mobile-visible={slot.mobileVisible}
    data-motion-opening={opening ? "" : undefined}
    style={{ "--editorial-column": slot.gridColumn, "--editorial-row": slot.gridRow } as EditorialStyle}
  >
    <Link className="editorial-album-object__cover" href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》专辑详情`}>
      <AlbumCover album={album} />
    </Link>
    <div className="editorial-album-object__caption">
      <p><Link href={`/albums/${album.slug}`}>{album.title}</Link></p>
      <p>{album.artists.map((artist, index) => <span key={artist.id}>{index ? "、" : ""}<Link href={`/artists/artist-${artist.neteaseArtistId}`}>{artist.name}</Link></span>)}</p>
      <p>{year}{album.rymRating != null ? ` · RYM ${album.rymRating.toFixed(2)}` : ""}</p>
    </div>
    <AlbumActions album={album} compact />
  </article>;
}

