import { getTopicSummaries } from "@/catalog/topics";
import { TopicIndex } from "@/components/topics/topic-index";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function DecadesPage() {
  const topics = getTopicSummaries("decade");
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container pa-decade-index" id="main-content"><header className="page-intro"><p className="eyebrow">按真实发行年份</p><h1>年代专题</h1><p>仅按专辑合法发行年份归类，不把收录时间当作发行时间。</p></header><TopicIndex topics={topics} /></main><SiteFooter /></div>;
}
