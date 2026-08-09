import { notFound } from "next/navigation";
import { getTopic, getTopicSummaries } from "@/catalog/topics";
import { TopicPage } from "@/components/topics/topic-page";
import { SiteShell } from "@/components/site-primitives";

export const dynamicParams = false;
export function generateStaticParams() { return getTopicSummaries("scene").map((topic) => ({ slug: topic.slug })); }
export default async function ScenePage({ params }: { params: Promise<{ slug: string }> }) {
  const topic = getTopic("scene", (await params).slug); if (!topic) notFound();
  return <SiteShell><TopicPage topic={topic} pathname={`/scenes/${topic.slug}`} /></SiteShell>;
}
