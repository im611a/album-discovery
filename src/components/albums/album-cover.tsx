import Image from "next/image";
import type { PublishedAlbum } from "@/catalog/schema";

export function AlbumCover({ album, size = "card" }: { album: Pick<PublishedAlbum, "cover" | "title" | "coreGenres" | "slug">; size?: "card" | "detail" }) {
  if (album.cover.kind === "local" && album.cover.src) {
    return <Image className={`album-cover album-cover--${size}`} src={album.cover.src} alt={album.cover.alt} width={500} height={500} priority={size === "detail"} unoptimized />;
  }
  const initials = album.title.replace(/[^\p{Letter}\p{Number}]/gu, "").slice(0, 2).toLocaleUpperCase("zh-CN") || "AD";
  return (
    <div className={`album-cover album-cover--fallback album-cover--${size}`} data-genre={album.coreGenres[0] ?? "other"} role="img" aria-label={album.cover.alt}>
      <span className="album-cover__mark" aria-hidden="true">{initials}</span>
      <span className="album-cover__line" aria-hidden="true" />
    </div>
  );
}
