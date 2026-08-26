import type { MetadataRoute } from "next";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return { rules: { userAgent: "*", allow: `${basePath}/` }, sitemap: `${base}/sitemap.xml` };
}
