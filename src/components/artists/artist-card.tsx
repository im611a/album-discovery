import Image from "next/image";
import Link from "next/link";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import type { PublishedArtistIndex } from "@/catalog/schema";

export function ArtistCard({ artist }: { artist: PublishedArtistIndex }) {
  return <article className="artist-card">
    <Link href={`/artists/${artist.slug}`} className="artist-card__link">
      <div className="artist-card__covers" aria-hidden="true">
        {artist.previewCovers.length ? artist.previewCovers.slice(0, 1).map((cover) => <Image key={cover} src={cover} width={160} height={160} alt="" loading="lazy" unoptimized />) : <span>{artist.name.slice(0, 1)}</span>}
      </div>
      <div className="artist-card__identity"><h3>{artist.name}</h3><p>{artist.albumCount} 张专辑{artist.earliestYear && artist.latestYear ? ` · ${artist.earliestYear}–${artist.latestYear}` : ""}</p>{artist.commonCoreGenres.length ? <p className="artist-card__genres">{artist.commonCoreGenres.slice(0, 2).map(getTaxonomyLabel).join(" · ")}</p> : null}</div>
      <span className="artist-card__open" aria-hidden="true">查看档案 ↗</span>
    </Link>
  </article>;
}
