import catalogJson from "@/data/generated/catalog-index.json";
import artistJson from "@/data/generated/artist-index.json";
import indexManifestJson from "@/data/generated/catalog-index.manifest.json";
import type { PublishedArtistCatalog, PublishedCatalogIndex } from "./schema";

export const publishedCatalog = catalogJson as PublishedCatalogIndex;
export const catalogAlbums = publishedCatalog.albums;
export const catalogTaxonomy = publishedCatalog.taxonomy;
export const descriptorTaxonomy = publishedCatalog.descriptorTaxonomy;
export const catalogRefreshDate = publishedCatalog.refreshDate;
export const publishedArtists = (artistJson as PublishedArtistCatalog).artists;
export const catalogIndexManifest = indexManifestJson;

if (catalogIndexManifest.catalogCount !== catalogAlbums.length || catalogIndexManifest.shardCount < 1) {
  throw new Error("本地目录索引清单与发布快照不一致，请重新运行 catalog:publish。");
}

const taxonomyLabelMap = new Map(
  catalogTaxonomy.map((item) => [item.key, item.labelZh ? `${item.labelZh}（${item.labelEn}）` : item.labelEn]),
);
const descriptorLabelMap = new Map(
  descriptorTaxonomy.map((item) => [item.key, item.labelZh ? `${item.labelZh}（${item.labelEn}）` : item.labelEn]),
);

export function getTaxonomyLabel(value: string) {
  return taxonomyLabelMap.get(value) ?? value;
}

export function getDescriptorLabel(value: string) {
  return descriptorLabelMap.get(value) ?? value;
}

export const getArtistBySlug = (slug: string) =>
  publishedArtists.find((artist) => artist.slug === slug) ?? null;
