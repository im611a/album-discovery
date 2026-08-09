import Link from "next/link";
import type { TopicSummary } from "@/catalog/topics";
import { AlbumCover } from "@/components/albums/album-cover";

const prefixes = { core: "/genres/core", related: "/genres/related", scene: "/scenes", decade: "/decades" };

export function TopicIndex({ topics }: { topics: TopicSummary[] }) {
  const kind = topics[0]?.kind ?? "core";
  return <div className="topic-grid r12-topic-index" data-topic-kind={kind}>{topics.map((topic, index) => <article className="topic-card" data-density={topic.count === 1 ? "sparse" : topic.count <= 4 ? "medium" : "dense"} data-preview-count={topic.previewAlbums.length} data-topic-position={index + 1} key={`${topic.kind}-${topic.key}`}>
    <Link href={`${prefixes[topic.kind]}/${topic.slug}`} className="topic-card__link">
      <div className="topic-card__covers" aria-hidden="true">{topic.previewAlbums.map((album) => <AlbumCover key={album.id} album={album} />)}</div>
      <div className="topic-card__identity"><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h2>{topic.label}</h2><p>{topic.count} 张专辑</p></div>
    </Link>
  </article>)}</div>;
}
