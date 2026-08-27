import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { RELEASE_TYPE_LABELS, type PublishedAlbumSummary } from "@/catalog/schema";
import { AlbumActions } from "./album-actions";
import { AlbumCover } from "./albums/album-cover";
import { ReturnContextLink } from "./navigation/return-journey";

function Highlighted({ text, query }: { text: string; query?: string }) {
  const trimmed = query?.trim();
  if (!trimmed) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return <>{parts.map((part, index) => part.toLocaleLowerCase("zh-CN") === trimmed.toLocaleLowerCase("zh-CN") ? <mark key={`${part}-${index}`}>{part}</mark> : part)}</>;
}

export function AlbumCard({ album, reason, actions = "compact", highlight, headingLevel = 2 }: { album: PublishedAlbumSummary; reason?: string | null; actions?: "compact" | "full"; highlight?: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="album-card">
      <ReturnContextLink className="album-card__overlay-link" href={`/albums/${album.slug}`} aria-label={`查看《${album.title}》专辑导览`} />
      <div className="album-card__link">
        <AlbumCover album={album} />
        <div className="album-card__body">
          <Heading className="album-card__title"><Highlighted text={album.title} query={highlight} /></Heading>
          <p className="album-card__artist">{album.artists.map((artist, index) => <span key={`${artist.id}-${index}`}>{index ? "、" : ""}<ReturnContextLink href={`/artists/artist-${artist.neteaseArtistId}`}><Highlighted text={artist.name} query={highlight} /></ReturnContextLink></span>)}</p>
          <p className="album-card__meta">{album.releaseDate?.slice(0, 4) ?? "日期暂缺"} · {RELEASE_TYPE_LABELS[album.albumType]}</p>
          {album.rymRating != null ? <p className="album-card__rating">RYM {album.rymRating.toFixed(2)}</p> : null}
          {album.coreGenres.length ? <div className="album-card__genres" aria-label="专辑核心流派">{album.coreGenres.slice(0, 2).map((genre) => <ReturnContextLink key={genre} href={`/discover?core=${encodeURIComponent(genre)}`} aria-label={`在目录中筛选${getTaxonomyLabel(genre)}`}>{getTaxonomyLabel(genre)}</ReturnContextLink>)}</div> : null}
          {reason ? <p className="album-card__reason">{reason}</p> : album.editorial ? <p className="album-card__reason">{album.editorial.summaryZh}</p> : null}
        </div>
      </div>
      <AlbumActions album={album} compact={actions === "compact"} />
    </article>
  );
}
