import catalogJson from "@/data/generated/catalog.json";
import type { PublishedCatalog } from "./schema";

const detailCatalog = catalogJson as PublishedCatalog;

export const getAlbumDetailBySlug = (slug: string) =>
  detailCatalog.albums.find((album) => album.slug === slug) ?? null;
