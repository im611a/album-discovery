import catalogJson from "@/data/generated/catalog-index.json";
import type { PublishedCatalogIndex } from "./schema";

export const publishedCatalog = catalogJson as PublishedCatalogIndex;
export const catalogAlbums = publishedCatalog.albums;
export const catalogTaxonomy = publishedCatalog.taxonomy;
export const descriptorTaxonomy = publishedCatalog.descriptorTaxonomy;
export const catalogRefreshDate = publishedCatalog.refreshDate;

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
