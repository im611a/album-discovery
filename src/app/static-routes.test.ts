import { describe, expect, it, vi } from "vitest";
import { catalogAlbums, publishedArtists } from "@/catalog/published-catalog";
import sitemap from "./sitemap";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

describe("static route contract", () => {
  it("generates exactly one detail parameter for every unique published slug", async () => {
    const { generateStaticParams } = await import("./albums/[slug]/page");
    const params = generateStaticParams();
    expect(params.length).toBe(catalogAlbums.length);
    expect(new Set(params.map((item) => item.slug)).size).toBe(params.length);
  });

  it("generates one artist route for every published artist slug", async () => {
    const { generateStaticParams } = await import("./artists/[slug]/page");
    const params = generateStaticParams();
    expect(params).toHaveLength(publishedArtists.length);
    expect(new Set(params.map((item) => item.slug)).size).toBe(params.length);
  });

  it("generates only non-empty topic detail routes", async () => {
    const core = (await import("./genres/core/[slug]/page")).generateStaticParams();
    const related = (await import("./genres/related/[slug]/page")).generateStaticParams();
    const scenes = (await import("./scenes/[slug]/page")).generateStaticParams();
    const decades = (await import("./decades/[slug]/page")).generateStaticParams();
    expect(core).toHaveLength(15);
    expect(related).toHaveLength(24);
    expect(scenes).toHaveLength(7);
    expect(decades).toHaveLength(9);
    expect(new Set([...core, ...related, ...scenes, ...decades].map((item) => item.slug)).size).toBeGreaterThan(0);
  });

  it("publishes all product pages and every album in the sitemap", () => {
    const routes = sitemap().map((item) => item.url);
    expect(routes.length).toBeGreaterThanOrEqual(67);
    for (const route of ["/discover", "/explore", "/scenes", "/decades", "/for-you", "/new-releases", "/artists", "/library", "/search", "/settings", "/about"]) expect(routes.some((url) => url.endsWith(route))).toBe(true);
    expect(routes.some((url) => url.endsWith("/genres") || url.includes("/genres/"))).toBe(false);
    expect(routes.filter((url) => url.includes("/albums/"))).toHaveLength(catalogAlbums.length);
    expect(routes.filter((url) => url.includes("/artists/"))).toHaveLength(publishedArtists.length);
  });
});
