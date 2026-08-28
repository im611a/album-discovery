import { notFound } from "next/navigation";
import { getTopic, getTopicSummaries } from "@/catalog/topics";
import Link from "next/link";
import { SiteShell } from "@/components/site-primitives";

export const dynamicParams = false;
export function generateStaticParams() { return getTopicSummaries("decade").map((topic) => ({ slug: topic.slug })); }
export default async function DecadePage({ params }: { params: Promise<{ slug: string }> }) {
  const topic = getTopic("decade", (await params).slug); if (!topic) notFound();
  return <SiteShell mainClassName="pa-taxonomy-handoff"><header className="page-intro" data-page-family="utility"><p className="eyebrow">CHRONOLOGY / COMPATIBILITY</p><h1>{topic.label}</h1><p>这一年代的 {topic.count} 张专辑现在由目录筛选统一呈现。</p></header><Link className="button button--primary" href={`/discover?decade=${encodeURIComponent(topic.key)}`}>查看 {topic.label} 专辑</Link></SiteShell>;
}
