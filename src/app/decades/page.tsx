import { getTopicSummaries } from "@/catalog/topics";
import { TopicIndex } from "@/components/topics/topic-index";
import { SiteShell } from "@/components/site-primitives";

export default function DecadesPage() {
  const topics = getTopicSummaries("decade");
  return <SiteShell mainClassName="pa-decade-index r12-decade-index"><header className="r12-decade-opening" data-opening-role="chronology"><div className="r12-decade-opening__identity"><p className="eyebrow">TIME / QUANTITY</p><h1>年代索引</h1><p>仅按专辑合法发行年份归类，不把收录时间当作发行时间。</p></div><ol aria-label="馆藏年代数量概览">{topics.map((topic) => <li key={topic.key}><span>{topic.label}</span><strong>{topic.count}</strong></li>)}</ol></header><div className="r12-decade-axis" aria-label="馆藏年代时间轴"><TopicIndex topics={topics} /></div></SiteShell>;
}
