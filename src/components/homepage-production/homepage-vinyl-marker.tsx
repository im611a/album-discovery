import Image from "next/image";
import Link from "next/link";
import type { HomepageAlbum } from "./homepage-data-adapter";

export function HomepageVinylMarker({ labelAlbum }: { labelAlbum: HomepageAlbum }) {
  return (
    <div className="ad-fixed">
      <div className="ad-marker" data-vinyl-label={labelAlbum.slug} data-audio-source="required">
        <span className="ad-marker__surface" aria-hidden="true">
          <span className="ad-marker__disc" />
          <span className="ad-marker__grooves" />
          <span className="ad-marker__shine" />
          <span className="ad-marker__ring" />
          <span className="ad-marker__ring ad-marker__ring--inner" />
          <span className="ad-marker__label" key={labelAlbum.albumId}><Image src={labelAlbum.cover} width={360} height={360} alt="" unoptimized priority /></span>
          <span className="ad-marker__hole" />
        </span>
        <div className="ad-vinyl-selection" aria-live="polite">
          <p><span>SELECTED RECORD</span><strong>{labelAlbum.title}</strong></p>
          <p>{labelAlbum.artists.join("、")}{labelAlbum.releaseYear ? ` · ${labelAlbum.releaseYear}` : ""}</p>
          <Link href={`/albums/${labelAlbum.slug}/?pfrom=home`} aria-label={`查看《${labelAlbum.title}》专辑详情`}>查看专辑 ↗</Link>
        </div>
      </div>
      <div className="ad-copyright" aria-hidden="true">© ALBUM DISCOVERY</div>
      <div className="ad-scroll-hint" aria-hidden="true"><i /></div>
    </div>
  );
}
