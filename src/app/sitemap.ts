import type { MetadataRoute } from "next";
import { getAllAlbums } from "@/catalog/queries";
import { publishedArtists } from "@/catalog/published-catalog";
import { getTopicSummaries } from "@/catalog/topics";
export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/discover", "/explore", "/scenes", "/decades", "/for-you", "/artists", "/library", "/search", "/settings", "/about"];
  const topicRoutes = [
    ...getTopicSummaries("scene").map((topic) => `/scenes/${topic.slug}`),
    ...getTopicSummaries("decade").map((topic) => `/decades/${topic.slug}`),
  ];
  return [
    ...routes.map((route) => ({ url: `${base}${route}`, changeFrequency: "weekly" as const, priority: route ? 0.7 : 1 })),
    ...topicRoutes.map((route) => ({ url: `${base}${route}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...getAllAlbums().map((album) => ({ url: `${base}/albums/${album.slug}`, lastModified: album.discoveredAt, changeFrequency: "monthly" as const, priority: album.editorial ? 0.8 : 0.6 })),
    ...publishedArtists.map((artist) => ({ url: `${base}/artists/${artist.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
