import { notFound } from "next/navigation";
import { getTopic, getTopicSummaries } from "@/catalog/topics";
import { TopicPage } from "@/components/topics/topic-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamicParams = false;
export function generateStaticParams() { return getTopicSummaries("scene").map((topic) => ({ slug: topic.slug })); }
export default async function ScenePage({ params }: { params: Promise<{ slug: string }> }) {
  const topic = getTopic("scene", (await params).slug); if (!topic) notFound();
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><TopicPage topic={topic} pathname={`/scenes/${topic.slug}`} /></main><SiteFooter /></div>;
}
