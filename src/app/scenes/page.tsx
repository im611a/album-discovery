import { getTopicSummaries } from "@/catalog/topics";
import { TopicIndex } from "@/components/topics/topic-index";
import { PageHeader, SiteShell } from "@/components/site-primitives";

export default function ScenesPage() {
  const topics = getTopicSummaries("scene");
  return <SiteShell mainClassName="pa-scene-index"><PageHeader eyebrow="本站策展维度" title="聆听场景">从实际使用情境出发继续发现；这些场景不是 RYM 或网易云官方分类。</PageHeader><TopicIndex topics={topics} /></SiteShell>;
}
