import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("site deployment paths", () => {
  it("keeps root-relative resources convenient for local development", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    const { withBasePath } = await import("./site-path");
    expect(withBasePath("/catalog/covers/detail/example.webp")).toBe("/catalog/covers/detail/example.webp");
  });

  it("prefixes local resources exactly once for a project Pages build", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/album-discovery");
    const { withBasePath } = await import("./site-path");
    expect(withBasePath("/catalog/covers/detail/example.webp")).toBe("/album-discovery/catalog/covers/detail/example.webp");
    expect(withBasePath("/album-discovery/catalog/covers/detail/example.webp")).toBe("/album-discovery/catalog/covers/detail/example.webp");
  });

  it("does not rewrite external, protocol-relative, or fragment references", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/album-discovery");
    const { withBasePath } = await import("./site-path");
    expect(withBasePath("https://example.com/cover.webp")).toBe("https://example.com/cover.webp");
    expect(withBasePath("//example.com/cover.webp")).toBe("//example.com/cover.webp");
    expect(withBasePath("#main-content")).toBe("#main-content");
  });
});
