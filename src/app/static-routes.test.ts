import { describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

describe("static route contract", () => {
  it("generates exactly one detail parameter for every unique published slug", async () => {
    const { generateStaticParams } = await import("./albums/[slug]/page");
    const params = generateStaticParams();
    expect(params.length).toBe(319);
    expect(new Set(params.map((item) => item.slug)).size).toBe(params.length);
  });

  it("generates one artist route for every published artist slug", async () => {
    const { generateStaticParams } = await import("./artists/[slug]/page");
    const params = generateStaticParams();
    expect(params).toHaveLength(274);
    expect(new Set(params.map((item) => item.slug)).size).toBe(params.length);
  });

  it("publishes all product pages and every album in the sitemap", () => {
    const routes = sitemap().map((item) => item.url);
    expect(routes.length).toBeGreaterThanOrEqual(67);
    for (const route of ["/discover", "/for-you", "/new-releases", "/artists", "/library", "/search", "/settings"]) expect(routes.some((url) => url.endsWith(route))).toBe(true);
    expect(routes.filter((url) => url.includes("/albums/"))).toHaveLength(319);
    expect(routes.filter((url) => url.includes("/artists/"))).toHaveLength(274);
  });
});
