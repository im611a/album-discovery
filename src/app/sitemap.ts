import type { MetadataRoute } from "next";
import { getAllAlbums } from "@/catalog/queries";
export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/discover", "/for-you", "/new-releases", "/library", "/search", "/settings"];
  return [...routes.map((route) => ({ url: `${base}${route}`, changeFrequency: "weekly" as const, priority: route ? 0.7 : 1 })), ...getAllAlbums().map((album) => ({ url: `${base}/albums/${album.slug}`, lastModified: album.sourceSummary.refreshedAt, changeFrequency: "monthly" as const, priority: album.editorial ? 0.8 : 0.6 }))];
}
