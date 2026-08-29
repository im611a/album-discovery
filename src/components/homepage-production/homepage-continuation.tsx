"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { HomepageExperienceAlbum, HomepageRelationshipOption } from "./homepage-experience-data";
import { HomepageRelationshipView } from "./homepage-relationship-view";

export function HomepageContinuation({ album, albums, options, onSelect }: {
  album: HomepageExperienceAlbum;
  albums: Readonly<Record<string, HomepageExperienceAlbum>>;
  options: readonly HomepageRelationshipOption[];
  onSelect: (albumId: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const visible = options.length ? Array.from({ length: Math.min(6, options.length) }, (_, index) => options[(index + offset) % options.length]!).map((option) => ({ option, target: albums[option.albumId] })).filter((item): item is { option: HomepageRelationshipOption; target: HomepageExperienceAlbum } => Boolean(item.target)) : [];
  return <section className="ad-continuation" aria-labelledby="home-continuation-title" data-continuation-source={album.slug}>
    <header><p>CONTINUE FROM THIS RECORD</p><h2 id="home-continuation-title">从《{album.title}》继续</h2><span>沿当前专辑在本地目录中的可说明关系，再翻几张。</span></header>
    {visible.length ? <ul>{visible.map(({ option, target }) => <li key={target.albumId}><Link href={`/albums/${target.slug}/`}><Image src={target.cover} width={360} height={360} alt="" unoptimized /><strong>{target.title}</strong><span>{target.artists.join("、")}</span><small>{option.lens}</small></Link></li>)}</ul> : <p className="ad-continuation__empty">当前专辑暂时没有足够的可说明关系；可以进入推荐继续浏览。</p>}
    <footer>{options.length > 6 ? <button type="button" onClick={() => setOffset((value) => (value + 6) % options.length)}>换一组</button> : null}<button type="button" aria-expanded={relationshipOpen} aria-controls="homepage-relationship-view" onClick={() => setRelationshipOpen((value) => !value)}>关系视图 ↗</button><Link href="/for-you">进入推荐 ↗</Link></footer>
    {relationshipOpen ? <div id="homepage-relationship-view"><HomepageRelationshipView album={album} albums={albums} options={options} onSelect={onSelect} /></div> : null}
  </section>;
}
