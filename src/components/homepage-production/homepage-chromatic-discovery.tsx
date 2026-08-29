"use client";

import Image from "next/image";
import { useState } from "react";
import type {
  ChromaticTag,
  HomepageExperienceAlbum,
} from "./homepage-experience-data";

const LABELS: Record<ChromaticTag, string> = {
  red: "红", orange: "橙", yellow: "黄", green: "绿", cyan: "青", blue: "蓝",
  purple: "紫", pink: "粉", mono: "黑白", dark: "暗色", multicolor: "多彩",
};

export function HomepageChromaticDiscovery({
  albums,
  chromaticAlbumIds,
  selectedAlbumId,
  onSelect,
}: {
  albums: Readonly<Record<string, HomepageExperienceAlbum>>;
  chromaticAlbumIds: Readonly<Record<ChromaticTag, readonly string[]>>;
  selectedAlbumId: string;
  onSelect: (albumId: string) => void;
}) {
  const [activeTag, setActiveTag] = useState<ChromaticTag>("multicolor");
  const visible = chromaticAlbumIds[activeTag].map((albumId) => albums[albumId]).filter(Boolean);
  return <section className="ad-chromatic" aria-labelledby="chromatic-title" data-chromatic-tag={activeTag}>
    <header>
      <p>CHROMATIC DISCOVERY</p>
      <h2 id="chromatic-title">按封面的颜色翻唱片</h2>
      <span>颜色只来自本地封面离线分析；它是一条视觉入口，不是音乐流派。</span>
    </header>
    <div className="ad-chromatic__filters" aria-label="封面颜色">
      {(Object.keys(LABELS) as ChromaticTag[]).map((tag) => <button
        type="button"
        key={tag}
        aria-pressed={activeTag === tag}
        onClick={() => setActiveTag(tag)}
      >{LABELS[tag]}</button>)}
    </div>
    <ul className="ad-chromatic__wall">
      {visible.map((album) => <li key={album.albumId}>
        <button
          type="button"
          className={selectedAlbumId === album.albumId ? "is-selected" : undefined}
          aria-label={`选择《${album.title}》，${album.artists.join("、")}`}
          aria-pressed={selectedAlbumId === album.albumId}
          onClick={() => onSelect(album.albumId)}
        >
          <Image src={album.cover} width={360} height={360} alt="" unoptimized />
          <span><strong>{album.title}</strong><small>{album.artists.join("、")} · {album.releaseYear ?? "年份暂缺"}</small></span>
        </button>
      </li>)}
    </ul>
  </section>;
}
