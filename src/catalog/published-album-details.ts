import { readFileSync } from "node:fs";
import path from "node:path";
import type { PublishedAlbum } from "./schema";

export const getAlbumDetailBySlug = (slug: string): PublishedAlbum | null => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "generated", "album-details", `${slug}.json`), "utf8")) as PublishedAlbum;
  } catch {
    return null;
  }
};
