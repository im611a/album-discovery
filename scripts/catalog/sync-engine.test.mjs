import { describe, expect, it, vi } from "vitest";
import { preserveRymFields, runCatalogSync } from "./sync-engine.mjs";

const album = (id, overrides = {}) => ({
  id: `album:${id}`,
  internalId: `album:${id}`,
  neteaseAlbumId: id,
  slug: `album-${id}`,
  title: `Album ${id}`,
  relatedGenres: [],
  descriptors: [],
  rymRating: null,
  rymRatingCount: null,
  rymReference: null,
  rymObservedAt: null,
  rymMatchStatus: "UNVERIFIED_NO_DATA",
  ...overrides,
});
const catalog = (albums = []) => ({
  version: 2,
  refreshDate: "2026-01-01",
  source: { generatedAt: "2026-01-01T00:00:00.000Z", runtimeRequestsAllowed: false },
  albums,
});
const dependencies = (overrides = {}) => ({
  fetchAlbum: vi.fn(async (seed) => ({ album: album(seed.albumId), cacheHit: false })),
  validateCatalog: vi.fn(async () => ({ ok: true, errors: [] })),
  publishCatalog: vi.fn(async () => {}),
  onCheckpoint: vi.fn(async () => {}),
  onFailure: vi.fn(async () => {}),
  ...overrides,
});

describe("catalog sync engine", () => {
  it("keeps dry-run publication-free", async () => {
    const deps = dependencies();
    const result = await runCatalogSync({ seeds: [{ albumId: "2" }], stableCatalog: catalog([album("1")]), dryRun: true, ...deps });
    expect(result.summary.added).toBe(1);
    expect(deps.publishCatalog).not.toHaveBeenCalled();
  });

  it("honors a positive limit", async () => {
    const deps = dependencies();
    const result = await runCatalogSync({ seeds: [{ albumId: "1" }, { albumId: "2" }, { albumId: "3" }], stableCatalog: catalog(), dryRun: true, limit: 2, ...deps });
    expect(result.summary.selectedSeeds).toBe(2);
    expect(deps.fetchAlbum).toHaveBeenCalledTimes(2);
  });

  it("resumes after processed album IDs", async () => {
    const deps = dependencies();
    await runCatalogSync({ seeds: [{ albumId: "1" }, { albumId: "2" }], stableCatalog: catalog(), checkpoint: { processedAlbumIds: ["1"] }, resume: true, dryRun: true, ...deps });
    expect(deps.fetchAlbum).toHaveBeenCalledOnce();
    expect(deps.fetchAlbum).toHaveBeenCalledWith(expect.objectContaining({ albumId: "2" }));
  });

  it("reports cache hits from the adapter", async () => {
    const deps = dependencies({ fetchAlbum: vi.fn(async (seed) => ({ album: album(seed.albumId), cacheHit: true })) });
    const result = await runCatalogSync({ seeds: [{ albumId: "2" }], stableCatalog: catalog(), dryRun: true, ...deps });
    expect(result.summary.cacheHits).toBe(1);
  });

  it("deduplicates repeated seeds and preserves idempotency", async () => {
    const deps = dependencies();
    const result = await runCatalogSync({ seeds: [{ albumId: "1" }, { albumId: "1" }], stableCatalog: catalog([album("1")]), dryRun: true, ...deps });
    expect(result.candidate.albums).toHaveLength(1);
    expect(deps.fetchAlbum).not.toHaveBeenCalled();
  });

  it("does not publish a run with item failures", async () => {
    const deps = dependencies({ fetchAlbum: vi.fn(async () => { throw new Error("fixture failure"); }) });
    const result = await runCatalogSync({ seeds: [{ albumId: "2" }], stableCatalog: catalog([album("1")]), ...deps });
    expect(result.failures).toHaveLength(1);
    expect(deps.publishCatalog).not.toHaveBeenCalled();
  });

  it("classifies platform verification without publishing or retrying in the engine", async () => {
    const error = Object.assign(new Error("verification"), { code: "PLATFORM_VERIFICATION_REQUIRED" });
    const deps = dependencies({ fetchAlbum: vi.fn(async () => { throw error; }) });
    const result = await runCatalogSync({ seeds: [{ albumId: "2" }], stableCatalog: catalog([album("1")]), ...deps });
    expect(deps.fetchAlbum).toHaveBeenCalledOnce();
    expect(result.summary).toMatchObject({ status: "PARTIAL", platformVerificationRequired: 1, failed: 1, published: false });
    expect(result.failures[0].category).toBe("PLATFORM_VERIFICATION_REQUIRED");
  });

  it("does not publish a validation failure", async () => {
    const deps = dependencies({ validateCatalog: vi.fn(async () => ({ ok: false, errors: ["bad candidate"] })) });
    await expect(runCatalogSync({ seeds: [{ albumId: "2" }], stableCatalog: catalog(), ...deps })).rejects.toThrow("bad candidate");
    expect(deps.publishCatalog).not.toHaveBeenCalled();
  });

  it("publishes new albums without RYM data as explicit nulls", async () => {
    const deps = dependencies();
    const result = await runCatalogSync({ seeds: [{ albumId: "2" }], stableCatalog: catalog(), ...deps });
    expect(result.candidate.albums[0]).toMatchObject({ rymRating: null, rymRatingCount: null, relatedGenres: [], rymMatchStatus: "UNVERIFIED_NO_DATA" });
  });

  it("preserves reliable RYM fields during a NetEase refresh", () => {
    const previous = album("1", { rymRating: 3.82, rymRatingCount: 1842, rymReference: "offline:1", rymObservedAt: "2026-01-01T00:00:00.000Z", rymMatchStatus: "MATCHED", relatedGenres: ["dream-pop"] });
    expect(preserveRymFields(album("1", { title: "Updated" }), previous)).toMatchObject({
      title: "Updated",
      rymRating: 3.82,
      rymRatingCount: 1842,
      relatedGenres: ["dream-pop"],
      rymMatchStatus: "MATCHED",
    });
  });
});
