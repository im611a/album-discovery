"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { AlbumDiscoveryPresentation } from "@/catalog/discovery/presentation";
import { withBasePath } from "@/lib/site-path";
import type { HomepageAlbum } from "./homepage-data-adapter";

export function HomepageContinuation({ album, presentation }: { album: HomepageAlbum; presentation: AlbumDiscoveryPresentation | null }) {
  const [offset, setOffset] = useState(0);
  const options = presentation ? [presentation.primary, ...presentation.alternates].filter((item): item is NonNullable<typeof item> => Boolean(item)) : [];
  const visible = options.length ? Array.from({ length: Math.min(6, options.length) }, (_, index) => options[(index + offset) % options.length]!) : [];
  return <section className="ad-continuation" aria-labelledby="home-continuation-title" data-continuation-source={album.slug}>
    <header><p>CONTINUE FROM THIS RECORD</p><h2 id="home-continuation-title">从《{album.title}》继续</h2><span>沿当前专辑在本地目录中的可说明关系，再翻几张。</span></header>
    {visible.length ? <ul>{visible.map((option) => <li key={option.target.id}><Link href={option.href}><Image src={withBasePath(option.target.cover.thumbnailSrc ?? option.target.cover.src ?? "/covers/placeholder.svg")} width={360} height={360} alt="" unoptimized /><strong>{option.target.title}</strong><span>{option.target.artists.map((artist) => artist.name).join("、")}</span><small>{option.lens}</small></Link></li>)}</ul> : <p className="ad-continuation__empty">当前专辑暂时没有足够的可说明关系；可以进入推荐继续浏览。</p>}
    <footer>{options.length > 6 ? <button type="button" onClick={() => setOffset((value) => (value + 6) % options.length)}>换一组</button> : null}<Link href="/for-you">进入推荐 ↗</Link></footer>
  </section>;
}
