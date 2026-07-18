import catalogJson from "@/data/generated/catalog.json";
import type { PublishedCatalog } from "./schema";

export const publishedCatalog = catalogJson as PublishedCatalog;
export const catalogAlbums = publishedCatalog.albums;
export const catalogTaxonomy = publishedCatalog.taxonomy;
export const catalogRefreshDate = publishedCatalog.refreshDate;

const taxonomyLabelMap = new Map(catalogTaxonomy.map((item) => [item.key, item.labelZh]));
const secondaryLabels: Record<string, string> = {
  "experimental-pop": "实验流行", "alternative-rock": "另类摇滚", shoegaze: "盯鞋", "instrumental-rock": "器乐摇滚",
  idm: "智能舞曲", "ambient-electronic": "氛围电子", "modern-jazz": "现代爵士", "neo-soul": "新灵魂乐",
  "alternative-hip-hop": "另类嘻哈", "singer-songwriter": "唱作人", "heavy-music": "重型音乐", "sinophone-album": "华语专辑",
};

export function getTaxonomyLabel(value: string) {
  return taxonomyLabelMap.get(value) ?? secondaryLabels[value] ?? value;
}
