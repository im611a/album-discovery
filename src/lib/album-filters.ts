import { albumsMock, type MockAlbum, type ReleaseType } from "@/data/albums.mock";
import { getDisplayLabel } from "@/lib/display-labels";

export const DECADE_OPTIONS = [
  { value: "all", label: "全部年代" },
  { value: "2020s", label: "2020年代" },
  { value: "2010s", label: "2010年代" },
  { value: "2000s", label: "2000年代" },
  { value: "1990s", label: "1990年代" },
  { value: "pre-1990s", label: "1980年代及更早" },
] as const;

export const RELEASE_TYPE_OPTIONS = [
  { value: "all", label: "全部类型" },
  { value: "album", label: "Album", releaseType: "Album" },
  { value: "ep", label: "EP", releaseType: "EP" },
  { value: "mixtape", label: "Mixtape", releaseType: "Mixtape" },
  { value: "soundtrack", label: "Soundtrack", releaseType: "Soundtrack" },
] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "最新发行" },
  { value: "oldest", label: "最早发行" },
  { value: "score", label: "RYM 评分最高" },
  { value: "ratings", label: "RYM 评分人数最多" },
] as const;

export type DecadeValue = (typeof DECADE_OPTIONS)[number]["value"];
export type ReleaseTypeValue = (typeof RELEASE_TYPE_OPTIONS)[number]["value"];
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
export type FilterKey =
  | "decade"
  | "releaseType"
  | "primaryGenre"
  | "secondaryGenre"
  | "descriptor";

export type TaxonomyKind =
  | "primaryGenre"
  | "secondaryGenre"
  | "descriptor";

export type FilterOption = {
  label: string;
  value: string;
};

export type DiscoverOptions = {
  primaryGenres: FilterOption[];
  secondaryGenres: FilterOption[];
  descriptors: FilterOption[];
};

export type DiscoverState = {
  decade: DecadeValue;
  releaseType: ReleaseTypeValue;
  primaryGenre: string | null;
  secondaryGenre: string | null;
  descriptor: string | null;
  sort: SortValue;
};

export type ActiveFilter = {
  key: FilterKey;
  label: string;
};

export const DEFAULT_DISCOVER_STATE: DiscoverState = {
  decade: "all",
  releaseType: "all",
  primaryGenre: null,
  secondaryGenre: null,
  descriptor: null,
  sort: "newest",
};

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function toStableOptionValue(label: string, prefix: string) {
  const asciiSlug = label
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return asciiSlug || `${prefix}-${stableHash(label)}`;
}

function collectOptions(
  albums: MockAlbum[],
  key: "primaryGenres" | "secondaryGenres" | "descriptors",
  prefix: string,
) {
  const labels = [...new Set(albums.flatMap((album) => album[key]))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
  const usedValues = new Map<string, string>();

  return labels.map((label) => {
    const initialValue = toStableOptionValue(label, prefix);
    const existingLabel = usedValues.get(initialValue);
    const value =
      existingLabel && existingLabel !== label
        ? `${initialValue}-${stableHash(label)}`
        : initialValue;

    usedValues.set(value, label);

    return { label, value };
  });
}

export function buildDiscoverOptions(albums: MockAlbum[]): DiscoverOptions {
  return {
    primaryGenres: collectOptions(albums, "primaryGenres", "primary"),
    secondaryGenres: collectOptions(albums, "secondaryGenres", "secondary"),
    descriptors: collectOptions(albums, "descriptors", "descriptor"),
  };
}

const prototypeDiscoverOptions = buildDiscoverOptions(albumsMock);

const taxonomyConfig = {
  primaryGenre: {
    options: prototypeDiscoverOptions.primaryGenres,
    queryKey: "primaryGenre",
  },
  secondaryGenre: {
    options: prototypeDiscoverOptions.secondaryGenres,
    queryKey: "secondaryGenre",
  },
  descriptor: {
    options: prototypeDiscoverOptions.descriptors,
    queryKey: "descriptor",
  },
} as const;

export function getDiscoverTaxonomyHref(
  kind: TaxonomyKind,
  sourceLabel: string,
) {
  const config = taxonomyConfig[kind];
  const value = config.options.find((option) => option.label === sourceLabel)?.value;

  if (!value) return "/discover";

  const search = new URLSearchParams({ [config.queryKey]: value });
  return `/discover?${search.toString()}`;
}

function isOptionValue(options: readonly { value: string }[], value: string | null) {
  return value !== null && options.some((option) => option.value === value);
}

export function parseDiscoverQuery(
  searchParams: Pick<URLSearchParams, "get">,
  options: DiscoverOptions,
): DiscoverState {
  const decade = searchParams.get("decade");
  const releaseType = searchParams.get("type");
  const primaryGenre = searchParams.get("primaryGenre");
  const secondaryGenre = searchParams.get("secondaryGenre");
  const descriptor = searchParams.get("descriptor");
  const sort = searchParams.get("sort");

  return {
    decade: isOptionValue(DECADE_OPTIONS, decade)
      ? (decade as DecadeValue)
      : DEFAULT_DISCOVER_STATE.decade,
    releaseType: isOptionValue(RELEASE_TYPE_OPTIONS, releaseType)
      ? (releaseType as ReleaseTypeValue)
      : DEFAULT_DISCOVER_STATE.releaseType,
    primaryGenre: isOptionValue(options.primaryGenres, primaryGenre)
      ? primaryGenre
      : null,
    secondaryGenre: isOptionValue(options.secondaryGenres, secondaryGenre)
      ? secondaryGenre
      : null,
    descriptor: isOptionValue(options.descriptors, descriptor) ? descriptor : null,
    sort: isOptionValue(SORT_OPTIONS, sort)
      ? (sort as SortValue)
      : DEFAULT_DISCOVER_STATE.sort,
  };
}

export function serializeDiscoverState(state: DiscoverState) {
  const params = new URLSearchParams();

  if (state.decade !== DEFAULT_DISCOVER_STATE.decade) {
    params.set("decade", state.decade);
  }
  if (state.releaseType !== DEFAULT_DISCOVER_STATE.releaseType) {
    params.set("type", state.releaseType);
  }
  if (state.primaryGenre) {
    params.set("primaryGenre", state.primaryGenre);
  }
  if (state.secondaryGenre) {
    params.set("secondaryGenre", state.secondaryGenre);
  }
  if (state.descriptor) {
    params.set("descriptor", state.descriptor);
  }
  if (state.sort !== DEFAULT_DISCOVER_STATE.sort) {
    params.set("sort", state.sort);
  }

  return params.toString();
}

function optionLabel(options: FilterOption[], value: string | null) {
  return options.find((option) => option.value === value)?.label ?? null;
}

function releaseTypeFor(value: ReleaseTypeValue): ReleaseType | null {
  const option = RELEASE_TYPE_OPTIONS.find((candidate) => candidate.value === value);

  return option && "releaseType" in option ? option.releaseType : null;
}

function matchesDecade(year: number, decade: DecadeValue) {
  if (decade === "all") return true;
  if (decade === "pre-1990s") return year <= 1989;

  const startYear = Number.parseInt(decade, 10);
  return year >= startYear && year <= startYear + 9;
}

function compareTitles(a: MockAlbum, b: MockAlbum) {
  return a.title.localeCompare(b.title, "zh-CN");
}

function compareNullableNumbersDescending(
  a: number | null,
  b: number | null,
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function filterAndSortAlbums(
  albums: MockAlbum[],
  state: DiscoverState,
  options: DiscoverOptions,
) {
  const releaseType = releaseTypeFor(state.releaseType);
  const primaryGenre = optionLabel(options.primaryGenres, state.primaryGenre);
  const secondaryGenre = optionLabel(options.secondaryGenres, state.secondaryGenre);
  const descriptor = optionLabel(options.descriptors, state.descriptor);

  const filteredAlbums = albums.filter(
    (album) =>
      matchesDecade(album.releaseYear, state.decade) &&
      (!releaseType || album.releaseType === releaseType) &&
      (!primaryGenre || album.primaryGenres.includes(primaryGenre)) &&
      (!secondaryGenre || album.secondaryGenres.includes(secondaryGenre)) &&
      (!descriptor || album.descriptors.includes(descriptor)),
  );

  return [...filteredAlbums].sort((a, b) => {
    if (state.sort === "oldest") {
      return a.releaseDate.localeCompare(b.releaseDate) || compareTitles(a, b);
    }

    if (state.sort === "score") {
      return (
        compareNullableNumbersDescending(a.rymScore, b.rymScore) ||
        compareNullableNumbersDescending(a.rymRatingCount, b.rymRatingCount) ||
        compareTitles(a, b)
      );
    }

    if (state.sort === "ratings") {
      return (
        compareNullableNumbersDescending(a.rymRatingCount, b.rymRatingCount) ||
        compareNullableNumbersDescending(a.rymScore, b.rymScore) ||
        compareTitles(a, b)
      );
    }

    return b.releaseDate.localeCompare(a.releaseDate) || compareTitles(a, b);
  });
}

export function getActiveFilters(
  state: DiscoverState,
  options: DiscoverOptions,
): ActiveFilter[] {
  const activeFilters: ActiveFilter[] = [];

  if (state.decade !== "all") {
    const label = DECADE_OPTIONS.find((option) => option.value === state.decade)?.label;
    if (label) activeFilters.push({ key: "decade", label: `年代：${label}` });
  }

  if (state.releaseType !== "all") {
    const label = RELEASE_TYPE_OPTIONS.find(
      (option) => option.value === state.releaseType,
    )?.label;
    if (label) {
      activeFilters.push({
        key: "releaseType",
        label: `发行类型：${getDisplayLabel(label)}`,
      });
    }
  }

  const primaryGenre = optionLabel(options.primaryGenres, state.primaryGenre);
  const secondaryGenre = optionLabel(options.secondaryGenres, state.secondaryGenre);
  const descriptor = optionLabel(options.descriptors, state.descriptor);

  if (primaryGenre) {
    activeFilters.push({
      key: "primaryGenre",
      label: `主流派：${getDisplayLabel(primaryGenre)}`,
    });
  }
  if (secondaryGenre) {
    activeFilters.push({
      key: "secondaryGenre",
      label: `次要流派：${getDisplayLabel(secondaryGenre)}`,
    });
  }
  if (descriptor) {
    activeFilters.push({
      key: "descriptor",
      label: `描述标签：${getDisplayLabel(descriptor)}`,
    });
  }

  return activeFilters;
}

export function removeFilter(state: DiscoverState, key: FilterKey): DiscoverState {
  if (key === "releaseType") return { ...state, releaseType: "all" };
  if (key === "decade") return { ...state, decade: "all" };

  return { ...state, [key]: null };
}
