import { notFound } from "next/navigation";
import { getTopic, getTopicSummaries } from "@/catalog/topics";
import { TopicPage } from "@/components/topics/topic-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamicParams = false;
export function generateStaticParams() { return getTopicSummaries("core").map((topic) => ({ slug: topic.slug })); }
export default async function CoreGenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const topic = getTopic("core", (await params).slug); if (!topic) notFound();
  return <div className="site-shell"><SiteHeader /><main className="page-main page-container" id="main-content"><TopicPage topic={topic} pathname={`/genres/core/${topic.slug}`} /></main><SiteFooter /></div>;
}
