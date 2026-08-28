import Image from "next/image";
import type { HomepageAlbum } from "./homepage-data-adapter";

export function HomepageVinylMarker({ labelAlbum }: { labelAlbum: HomepageAlbum }) {
  return (
    <div className="ad-fixed" aria-hidden="true">
      <div className="ad-marker" data-vinyl-label={labelAlbum.slug} data-audio-source="required">
        <span className="ad-marker__surface">
          <span className="ad-marker__disc" />
          <span className="ad-marker__grooves" />
          <span className="ad-marker__shine" />
          <span className="ad-marker__ring" />
          <span className="ad-marker__ring ad-marker__ring--inner" />
          <span className="ad-marker__label"><Image src={labelAlbum.cover} width={360} height={360} alt="" unoptimized priority /></span>
          <span className="ad-marker__hole" />
        </span>
      </div>
      <div className="ad-copyright">© ALBUM DISCOVERY</div>
      <div className="ad-scroll-hint"><i /></div>
    </div>
  );
}
