"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type {
  HomepageExperienceAlbum,
  HomepageRelationshipOption,
} from "./homepage-experience-data";

export function HomepageRelationshipView({
  album,
  albums,
  options,
  onSelect,
}: {
  album: HomepageExperienceAlbum;
  albums: Readonly<Record<string, HomepageExperienceAlbum>>;
  options: readonly HomepageRelationshipOption[];
  onSelect: (albumId: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shouldFocus = useRef(false);
  useEffect(() => {
    if (shouldFocus.current) {
      headingRef.current?.focus();
      shouldFocus.current = false;
    }
  }, [album.albumId]);
  return <div className="ad-relationship" data-relationship-center={album.albumId}>
    <div className="ad-relationship__center" key={album.albumId}>
      <p>CURRENT CENTER</p>
      <Image src={album.cover} width={480} height={480} alt="" unoptimized />
      <h3 ref={headingRef} tabIndex={-1}>{album.title}</h3>
      <span>{album.artists.join("、")}</span>
      <Link href={`/albums/${album.slug}/`}>查看专辑 ↗</Link>
    </div>
    {options.length ? <ul aria-label={`与《${album.title}》相关的专辑`}>
      {options.map((option) => {
        const related = albums[option.albumId];
        if (!related) return null;
        return <li key={related.albumId}><button type="button" onClick={() => {
          shouldFocus.current = true;
          onSelect(related.albumId);
        }}>
          <Image src={related.cover} width={240} height={240} alt="" unoptimized />
          <span><strong>{related.title}</strong><small>{option.lens}</small></span>
        </button></li>;
      })}
    </ul> : <p className="ad-relationship__empty">当前专辑没有足够的本地关系证据。</p>}
  </div>;
}
