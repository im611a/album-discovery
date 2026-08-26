import Image from "next/image";
import type { PublishedCover } from "@/catalog/schema";
import { withBasePath } from "@/lib/site-path";

type AlbumCoverTarget = {
  readonly cover: PublishedCover;
  readonly title: string;
  readonly coreGenres: readonly string[];
  readonly slug: string;
};

export function AlbumCover({ album, size = "card" }: { album: AlbumCoverTarget; size?: "card" | "detail" }) {
  if (album.cover.kind === "local" && album.cover.src) {
    const source = size === "card" ? album.cover.thumbnailSrc ?? album.cover.src : album.cover.src;
    return <Image className={`album-cover album-cover--${size}`} src={withBasePath(source)} alt={album.cover.alt} width={size === "detail" ? 960 : 360} height={size === "detail" ? 960 : 360} priority={size === "detail"} loading={size === "card" ? "lazy" : undefined} unoptimized />;
  }
  const initials = album.title.replace(/[^\p{Letter}\p{Number}]/gu, "").slice(0, 2).toLocaleUpperCase("zh-CN") || "AD";
  return (
    <div className={`album-cover album-cover--fallback album-cover--${size}`} data-genre={album.coreGenres[0] ?? "other"} role="img" aria-label={album.cover.alt}>
      <span className="album-cover__mark" aria-hidden="true">{initials}</span>
      <span className="album-cover__line" aria-hidden="true" />
    </div>
  );
}
