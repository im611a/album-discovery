import Image from "next/image";
import type { PublishedAlbum } from "@/catalog/schema";

export function AlbumCover({ album, size = "card" }: { album: Pick<PublishedAlbum, "cover" | "title" | "coreGenres" | "slug">; size?: "card" | "detail" }) {
  if (album.cover.kind === "local" && album.cover.src) {
    const source = size === "card" ? album.cover.thumbnailSrc ?? album.cover.src : album.cover.src;
    return <Image className={`album-cover album-cover--${size}`} src={source} alt={album.cover.alt} width={size === "detail" ? 960 : 360} height={size === "detail" ? 960 : 360} priority={size === "detail"} loading={size === "card" ? "lazy" : undefined} unoptimized />;
  }
  const initials = album.title.replace(/[^\p{Letter}\p{Number}]/gu, "").slice(0, 2).toLocaleUpperCase("zh-CN") || "AD";
  return (
    <div className={`album-cover album-cover--fallback album-cover--${size}`} data-genre={album.coreGenres[0] ?? "other"} role="img" aria-label={album.cover.alt}>
      <span className="album-cover__mark" aria-hidden="true">{initials}</span>
      <span className="album-cover__line" aria-hidden="true" />
    </div>
  );
}
