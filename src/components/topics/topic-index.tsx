import Link from "next/link";
import type { TopicSummary } from "@/catalog/topics";
import { AlbumCover } from "@/components/albums/album-cover";

const prefixes = { core: "/genres/core", related: "/genres/related", scene: "/scenes", decade: "/decades" };

export function TopicIndex({ topics }: { topics: TopicSummary[] }) {
  const kind = topics[0]?.kind ?? "core";
  return <div className="topic-grid" data-topic-kind={kind}>{topics.map((topic) => <article className="topic-card" key={`${topic.kind}-${topic.key}`}>
    <Link href={`${prefixes[topic.kind]}/${topic.slug}`} className="topic-card__link">
      <div className="topic-card__covers" aria-hidden="true">{topic.previewAlbums.map((album) => <AlbumCover key={album.id} album={album} />)}</div>
      <div><h2>{topic.label}</h2><p>{topic.count} 张专辑</p></div>
    </Link>
  </article>)}</div>;
}
