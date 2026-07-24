import Image from "next/image";
import Link from "next/link";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import type { PublishedArtistIndex } from "@/catalog/schema";

export function ArtistEditorialRow({ artist }: { artist: PublishedArtistIndex }) {
  return (
    <article className="artist-editorial-row">
      <Link className="artist-editorial-row__cover" href={`/artists/${artist.slug}`} aria-label={`查看艺人 ${artist.name}`}>
        {artist.previewCovers[0]
          ? <Image src={artist.previewCovers[0]} width={160} height={160} alt="" loading="lazy" unoptimized />
          : <span aria-hidden="true">{artist.name.slice(0, 1)}</span>}
      </Link>
      <div className="artist-editorial-row__identity">
        <h3><Link href={`/artists/${artist.slug}`}>{artist.name}</Link></h3>
        <p>{artist.albumCount} 张专辑{artist.earliestYear && artist.latestYear ? ` · ${artist.earliestYear}–${artist.latestYear}` : ""}</p>
      </div>
      {artist.commonCoreGenres.length
        ? <p className="artist-editorial-row__genres">{artist.commonCoreGenres.slice(0, 3).map(getTaxonomyLabel).join(" · ")}</p>
        : <p className="artist-editorial-row__genres">流派资料暂缺</p>}
      <Link className="artist-editorial-row__action" href={`/artists/${artist.slug}`}>查看档案</Link>
    </article>
  );
}
