import Link from "next/link";
import { Suspense } from "react";
import type { TopicSummary } from "@/catalog/topics";
import { getTopicAlbums } from "@/catalog/topics";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { TopicCatalogFallback } from "@/components/catalog-geometry-fallback";
import { TopicCatalog } from "./topic-catalog";

export function TopicPage({ topic, pathname }: { topic: TopicSummary; pathname: string }) {
  const albums = getTopicAlbums(topic.kind, topic.key);
  const indexRoute = topic.kind === "decade" ? "/decades" : topic.kind === "scene" ? "/scenes" : "/genres";
  const indexLabel = topic.kind === "decade" ? "年代" : topic.kind === "scene" ? "聆听场景" : "流派";
  return <article className="pa-topic-file" data-topic-kind={topic.kind}>
    <nav className="breadcrumbs" aria-label="面包屑"><Link href={indexRoute}>{indexLabel}</Link><span aria-hidden="true">/</span><span>{topic.label}</span></nav>
    <header className="page-intro topic-intro r12-topic-file__intro"><p className="eyebrow">{topic.kind === "scene" ? "本站策展维度" : topic.kind === "related" ? "RYM Secondary Genres" : "专辑专题"}</p><h1>{topic.label}</h1><p><strong>{topic.count}</strong> 张专辑。{topic.kind === "scene" ? "场景是本站策展维度，不代表平台或 RYM 官方分类。" : "按当前静态馆藏呈现，不补造缺失分类。"}</p></header>
    {topic.commonCoreGenres.length ? <div className="topic-common"><span>常见核心流派</span>{topic.commonCoreGenres.map((item) => <Link key={item.key} href={`/genres/core/${item.key}`}>{getTaxonomyLabel(item.key)} · {item.count}</Link>)}</div> : null}
    <Suspense fallback={<TopicCatalogFallback albums={albums} kind={topic.kind} />}><TopicCatalog albums={albums} kind={topic.kind} topicKey={topic.key} pathname={pathname} /></Suspense>
    <nav className="topic-return-links" aria-label="继续浏览"><Link href="/discover">返回专辑目录</Link><Link href={indexRoute}>浏览其他{indexLabel}</Link></nav>
  </article>;
}
