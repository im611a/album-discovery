import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveStaticFile } from "./static-paths.mjs";

const root = mkdtempSync(path.join(tmpdir(), "album-static-paths-"));
writeFileSync(path.join(root, "404.html"), "not found");
mkdirSync(path.join(root, "discover", "__next.discover"), { recursive: true });
writeFileSync(path.join(root, "discover", "index.html"), "discover");
writeFileSync(path.join(root, "discover", "__next.discover", "__PAGE__.txt"), "discover page");
mkdirSync(path.join(root, "albums", "example", "__next.albums", "$d$slug"), { recursive: true });
writeFileSync(path.join(root, "albums", "example", "__next.albums", "$d$slug.txt"), "album segment");
writeFileSync(path.join(root, "albums", "example", "__next.albums", "$d$slug", "__PAGE__.txt"), "album page");

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("static export path resolution", () => {
  it("serves a directory index", () => {
    expect(resolveStaticFile(root, "/discover/")).toEqual({
      status: 200,
      file: path.join(root, "discover", "index.html"),
    });
  });

  it("maps a dot-encoded static RSC page to its exported directory", () => {
    expect(resolveStaticFile(root, "/discover/__next.discover.__PAGE__.txt")).toEqual({
      status: 200,
      file: path.join(root, "discover", "__next.discover", "__PAGE__.txt"),
    });
  });

  it("maps dynamic segment RSC paths without guessing unrelated files", () => {
    expect(resolveStaticFile(root, "/albums/example/__next.albums.$d$slug.txt")).toEqual({
      status: 200,
      file: path.join(root, "albums", "example", "__next.albums", "$d$slug.txt"),
    });
    expect(resolveStaticFile(root, "/albums/example/__next.albums.$d$slug.__PAGE__.txt")).toEqual({
      status: 200,
      file: path.join(root, "albums", "example", "__next.albums", "$d$slug", "__PAGE__.txt"),
    });
  });

  it("returns the friendly 404 and rejects traversal", () => {
    expect(resolveStaticFile(root, "/missing/")).toEqual({ status: 404, file: path.join(root, "404.html") });
    expect(resolveStaticFile(root, "/../../outside")).toEqual({ status: 400, file: null });
  });
});
