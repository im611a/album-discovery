import Link from "next/link";
import { Suspense } from "react";
import type { TopicSummary } from "@/catalog/topics";
import { getTopicAlbums } from "@/catalog/topics";
import { getTaxonomyLabel } from "@/catalog/published-catalog";
import { TopicCatalog } from "./topic-catalog";

export function TopicPage({ topic, pathname }: { topic: TopicSummary; pathname: string }) {
  const albums = getTopicAlbums(topic.kind, topic.key);
  return <article className="pa-topic-file" data-topic-kind={topic.kind}>
    <nav className="breadcrumbs" aria-label="面包屑"><Link href="/explore">探索</Link><span aria-hidden="true">/</span><span>{topic.label}</span></nav>
    <header className="page-intro topic-intro"><p className="eyebrow">{topic.kind === "scene" ? "本站策展维度" : topic.kind === "related" ? "RYM Secondary Genres" : "专辑专题"}</p><h1>{topic.label}</h1><p>当前目录中共 {topic.count} 张专辑。{topic.kind === "scene" ? "场景是本站策展维度，不代表平台或 RYM 官方分类。" : ""}</p></header>
    {topic.commonCoreGenres.length ? <div className="topic-common"><span>常见核心流派</span>{topic.commonCoreGenres.map((item) => <Link key={item.key} href={`/genres/core/${item.key}`}>{getTaxonomyLabel(item.key)} · {item.count}</Link>)}</div> : null}
    <Suspense fallback={<p className="status-message">正在准备专题目录…</p>}><TopicCatalog albums={albums} kind={topic.kind} topicKey={topic.key} pathname={pathname} /></Suspense>
    <nav className="topic-return-links" aria-label="继续浏览"><Link href="/discover">返回发现页</Link><Link href="/explore">探索其他路径</Link></nav>
  </article>;
}
