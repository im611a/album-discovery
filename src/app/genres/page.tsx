import { getTopicSummaries } from "@/catalog/topics";
import { TopicIndex } from "@/components/topics/topic-index";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function GenresPage() {
  const core = getTopicSummaries("core");
  const related = getTopicSummaries("related");
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container pa-genre-index" id="main-content">
    <header className="page-intro"><p className="eyebrow">真实目录分类</p><h1>流派专题</h1><p>核心流派来自目录的人工确认分类；相关流派只来自可靠匹配的离线 RYM Secondary Genres。</p></header>
    <section aria-labelledby="core-genres-title"><h2 id="core-genres-title" className="topic-section-title">核心流派</h2><TopicIndex topics={core} /></section>
    {related.length ? <section aria-labelledby="related-genres-title" className="topic-section"><h2 id="related-genres-title" className="topic-section-title">相关流派</h2><p className="section-note">仅展示当前目录真实存在的 RYM Secondary Genres。</p><TopicIndex topics={related} /></section> : null}
  </main><SiteFooter /></div>;
}
