import Link from "next/link";
import { getTopicSummaries } from "@/catalog/topics";
import { AlbumCover } from "@/components/albums/album-cover";
import { SiteShell } from "@/components/site-primitives";

export default function DecadesPage() {
  const topics = [...getTopicSummaries("decade")].sort((left, right) => left.key.localeCompare(right.key));
  return <SiteShell mainClassName="pa-decade-index ux-decades">
    <header className="ux-decades__opening" data-opening-role="chronology">
      <p className="eyebrow">CHRONOLOGICAL INDEX / {topics.length} DECADES</p>
      <h1>沿发行年代浏览</h1>
      <p>仅按专辑合法发行年份归类，不把收录时间当作发行时间。每个节点直接回到相应年代的目录结果。</p>
    </header>
    <ol className="ux-decades__timeline" aria-label="馆藏年代时间轴">
      {topics.map((topic, index) => <li key={topic.key}>
        <Link href={`/discover?decade=${encodeURIComponent(topic.key)}`}>
          <span className="ux-decades__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className="ux-decades__identity"><strong>{topic.label}</strong><small>{topic.count} 张专辑</small></span>
          <span className="ux-decades__covers" aria-hidden="true">{topic.previewAlbums.slice(0, 4).map((album) => <AlbumCover key={album.id} album={album} />)}</span>
          <span className="ux-decades__action">查看这一年代 <span aria-hidden="true">→</span></span>
        </Link>
      </li>)}
    </ol>
  </SiteShell>;
}
