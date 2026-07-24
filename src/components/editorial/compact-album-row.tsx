import Link from "next/link";
import { AlbumActions } from "@/components/album-actions";
import { AlbumCover } from "@/components/albums/album-cover";
import { RELEASE_TYPE_LABELS, type PublishedAlbumSummary } from "@/catalog/schema";

export function CompactAlbumRow({ album, index }: { album: PublishedAlbumSummary; index: number }) {
  return <article className="compact-album-row">
    <span className="compact-album-row__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
    <Link className="compact-album-row__cover" href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》专辑详情`}><AlbumCover album={album} /></Link>
    <div className="compact-album-row__identity">
      <h3><Link href={`/albums/${album.slug}`}>{album.title}</Link></h3>
      <p>{album.artists.map((artist, artistIndex) => <span key={artist.id}>{artistIndex ? "、" : ""}<Link href={`/artists/artist-${artist.neteaseArtistId}`}>{artist.name}</Link></span>)}</p>
    </div>
    <p className="compact-album-row__meta">{album.releaseYear ?? "日期暂缺"} · {RELEASE_TYPE_LABELS[album.albumType]}</p>
    {album.rymRating != null ? <p className="compact-album-row__rating">RYM {album.rymRating.toFixed(2)}</p> : null}
    <AlbumActions album={album} compact />
  </article>;
}

