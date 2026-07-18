import Link from "next/link";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import type { PublishedAlbum } from "@/catalog/schema";
import { AlbumActions } from "./album-actions";
import { AlbumCover } from "./albums/album-cover";

function Highlighted({ text, query }: { text: string; query?: string }) {
  const trimmed = query?.trim();
  if (!trimmed) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return <>{parts.map((part, index) => part.toLocaleLowerCase("zh-CN") === trimmed.toLocaleLowerCase("zh-CN") ? <mark key={`${part}-${index}`}>{part}</mark> : part)}</>;
}

export function AlbumCard({ album, reason, actions = "compact", highlight }: { album: PublishedAlbum; reason?: string | null; actions?: "compact" | "full"; highlight?: string }) {
  return (
    <article className="album-card">
      <Link className="album-card__link" href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》专辑导览`}>
        <AlbumCover album={album} />
        <div className="album-card__body">
          <h3 className="album-card__title"><Highlighted text={album.title} query={highlight} /></h3>
          <p className="album-card__artist"><Highlighted text={album.artists.map((artist) => artist.name).join("、")} query={highlight} /></p>
          <p className="album-card__meta">{album.releaseDate?.value.slice(0, 4) ?? "日期暂缺"} · {getTaxonomyLabel(album.primaryGenres[0] ?? "")}</p>
          {reason ? <p className="album-card__reason">{reason}</p> : album.editorial ? <p className="album-card__reason">{album.editorial.summaryZh}</p> : null}
        </div>
      </Link>
      <AlbumActions album={album} compact={actions === "compact"} />
    </article>
  );
}
