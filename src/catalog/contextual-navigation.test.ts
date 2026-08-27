import { describe, expect, it } from "vitest";

import { catalogAlbums } from "./published-catalog";
import { buildCrossProductEntityHref, MAX_CROSS_PRODUCT_CONTEXT_URL_LENGTH } from "./contextual-navigation";

describe("R16 bounded cross-product navigation", () => {
  const current = catalogAlbums[0]!;

  it("keeps R13, R14 and R15 authorities independently across Album to Artist", () => {
    const href = buildCrossProductEntityHref({
      pathname: `/artists/artist-${current.artists[0]!.neteaseArtistId}`,
      currentAlbumSlug: current.slug,
      searchParams: `entry=explore&trail=${current.slug}&via=SHARED_ARTIST&pfrom=for-you&ptrail=${catalogAlbums[1]!.slug}&lfrom=library&lview=favorite`,
      catalog: catalogAlbums,
    });
    expect(href).toContain("entry=explore");
    expect(href).toContain("via=SHARED_ARTIST");
    expect(href).toContain("pfrom=for-you");
    expect(href).toContain(`ptrail=${catalogAlbums[1]!.slug}%7E${current.slug}`);
    expect(href).toContain("lfrom=library");
    expect(href).toContain("lview=favorite");
  });

  it.each([
    "",
    "pfrom=",
    "pfrom=unknown&ptrail=%25ZZ",
    "lfrom=library&sfrom=search&sq=test",
    "entry=unknown&entryKey=self&trail=missing~missing&via=unknown",
    `pfrom=for-you&ptrail=${"x".repeat(2_000)}&sq=${"y".repeat(2_000)}`,
  ])("normalizes malformed or mixed input without losing canonical usability: %s", (searchParams) => {
    const first = buildCrossProductEntityHref({ pathname: "/artists/artist-1", currentAlbumSlug: current.slug, searchParams, catalog: catalogAlbums });
    const replay = buildCrossProductEntityHref({ pathname: "/artists/artist-1", currentAlbumSlug: current.slug, searchParams: first.split("?")[1] ?? "", catalog: catalogAlbums });
    expect(first).toMatch(/^\/artists\/artist-1(?:\?|$)/);
    expect(first.length).toBeLessThanOrEqual(MAX_CROSS_PRODUCT_CONTEXT_URL_LENGTH);
    expect(replay.length).toBeLessThanOrEqual(MAX_CROSS_PRODUCT_CONTEXT_URL_LENGTH);
    expect((first.match(/pfrom=/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((first.match(/lfrom=/g) ?? []).length).toBeLessThanOrEqual(1);
    expect((first.match(/sfrom=/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("rejects protocol-relative destinations rather than creating an open redirect", () => {
    expect(buildCrossProductEntityHref({ pathname: "//evil.example", currentAlbumSlug: current.slug, catalog: catalogAlbums })).toBe("/");
  });

  it("preserves an existing catalog filter while appending bounded discovery context", () => {
    const href = buildCrossProductEntityHref({
      pathname: "/discover?core=hip-hop",
      currentAlbumSlug: current.slug,
      catalog: catalogAlbums,
    });
    expect(href).toContain("/discover?core=hip-hop&entry=album");
    expect(new URLSearchParams(href.split("?")[1]).get("core")).toBe("hip-hop");
  });
});
