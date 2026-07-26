import { getTopicSummaries } from "@/catalog/topics";
import { TopicIndex } from "@/components/topics/topic-index";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ScenesPage() {
  const topics = getTopicSummaries("scene");
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container pa-scene-index" id="main-content"><header className="page-intro"><p className="eyebrow">本站策展维度</p><h1>聆听场景</h1><p>从实际使用情境出发继续发现；这些场景不是 RYM 或网易云官方分类。</p></header><TopicIndex topics={topics} /></main><SiteFooter /></div>;
}
