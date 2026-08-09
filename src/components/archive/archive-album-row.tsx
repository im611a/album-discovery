import Link from "next/link";

import type { PublishedAlbumSummary } from "@/catalog/schema";
import { RELEASE_TYPE_LABELS } from "@/catalog/schema";
import { AlbumActions } from "@/components/album-actions";
import { AlbumCover } from "@/components/albums/album-cover";

export function ArchiveAlbumRow({ album }: { album: PublishedAlbumSummary }) {
  return (
    <article className="r12-archive-row">
      <Link className="r12-archive-row__cover" href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》专辑详情`}>
        <AlbumCover album={album} />
      </Link>
      <div className="r12-archive-row__identity">
        <h3><Link href={`/albums/${album.slug}`}>{album.title}</Link></h3>
        <p>{album.artists.map((artist, index) => <span key={artist.id}>{index ? "、" : ""}<Link href={`/artists/artist-${artist.neteaseArtistId}`}>{artist.name}</Link></span>)}</p>
      </div>
      <p className="r12-archive-row__release">{album.releaseYear ?? "年份暂缺"}<span>{RELEASE_TYPE_LABELS[album.albumType]}</span></p>
      <AlbumActions album={album} compact />
    </article>
  );
}
