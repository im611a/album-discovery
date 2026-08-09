import { getTopicSummaries } from "@/catalog/topics";
import { TopicIndex } from "@/components/topics/topic-index";
import { SiteShell } from "@/components/site-primitives";

export default function GenresPage() {
  const core = getTopicSummaries("core");
  const related = getTopicSummaries("related");
  return <SiteShell mainClassName="pa-genre-index r12-taxonomy-index">
    <header className="r12-taxonomy-opening" data-opening-role="taxonomy">
      <div><p className="eyebrow">TAXONOMY / DENSITY</p><h1>流派索引</h1><p>核心流派来自目录的人工确认分类；相关流派只来自可靠匹配的离线 RYM Secondary Genres。</p></div>
      <dl aria-label="流派索引规模"><div><dt>核心流派</dt><dd>{core.length}</dd></div><div><dt>相关流派</dt><dd>{related.length}</dd></div></dl>
    </header>
    <section className="r12-taxonomy-section" aria-labelledby="core-genres-title"><header><p className="section-kicker">PRIMARY TAXONOMY</p><h2 id="core-genres-title" className="topic-section-title">核心流派</h2><p>{core.length} 个入口，版面重量随真实专辑数量变化。</p></header><TopicIndex topics={core} /></section>
    {related.length ? <section aria-labelledby="related-genres-title" className="topic-section r12-taxonomy-section r12-taxonomy-section--related"><header><p className="section-kicker">VERIFIED SECONDARY TAXONOMY</p><h2 id="related-genres-title" className="topic-section-title">相关流派</h2><p className="section-note">仅展示当前目录真实存在的 RYM Secondary Genres。</p></header><TopicIndex topics={related} /></section> : null}
  </SiteShell>;
}
