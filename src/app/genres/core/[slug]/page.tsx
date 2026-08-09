import { notFound } from "next/navigation";
import { getTopic, getTopicSummaries } from "@/catalog/topics";
import { TopicPage } from "@/components/topics/topic-page";
import { SiteShell } from "@/components/site-primitives";

export const dynamicParams = false;
export function generateStaticParams() { return getTopicSummaries("core").map((topic) => ({ slug: topic.slug })); }
export default async function CoreGenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const topic = getTopic("core", (await params).slug); if (!topic) notFound();
  return <SiteShell><TopicPage topic={topic} pathname={`/genres/core/${topic.slug}`} /></SiteShell>;
}
