import type { MockAlbum, ReleaseType } from "@/data/albums.mock";
import type {
  MarketChannel,
  MockNewReleaseSourceContext,
} from "@/data/new-releases.mock";

export const MARKET_CHANNEL_OPTIONS = [
  { value: "ALL", queryValue: "all", label: "全部" },
  { value: "ZH", queryValue: "zh", label: "华语新碟" },
  { value: "EA", queryValue: "ea", label: "欧美新碟" },
  { value: "JP", queryValue: "jp", label: "日本新碟" },
  { value: "KR", queryValue: "kr", label: "韩国新碟" },
] as const satisfies readonly {
  value: MarketChannel;
  queryValue: string;
  label: string;
}[];

export const NEW_RELEASE_TYPE_OPTIONS = [
  { value: "all", label: "全部类型", releaseType: null },
  { value: "album", label: "Album", releaseType: "Album" },
  { value: "ep", label: "EP", releaseType: "EP" },
  { value: "mixtape", label: "Mixtape", releaseType: "Mixtape" },
  { value: "soundtrack", label: "Soundtrack", releaseType: "Soundtrack" },
] as const satisfies readonly {
  value: string;
  label: string;
  releaseType: ReleaseType | null;
}[];

export type NewReleaseTypeValue = (typeof NEW_RELEASE_TYPE_OPTIONS)[number]["value"];

export type NewReleaseState = {
  channel: MarketChannel;
  releaseType: NewReleaseTypeValue;
};

export const DEFAULT_NEW_RELEASE_STATE: NewReleaseState = {
  channel: "ALL",
  releaseType: "all",
};

function channelFromQuery(value: string | null): MarketChannel {
  return (
    MARKET_CHANNEL_OPTIONS.find((option) => option.queryValue === value)?.value ??
    DEFAULT_NEW_RELEASE_STATE.channel
  );
}

function typeFromQuery(value: string | null): NewReleaseTypeValue {
  return (
    NEW_RELEASE_TYPE_OPTIONS.find((option) => option.value === value)?.value ??
    DEFAULT_NEW_RELEASE_STATE.releaseType
  );
}

export function parseNewReleaseQuery(
  searchParams: Pick<URLSearchParams, "get">,
): NewReleaseState {
  return {
    channel: channelFromQuery(searchParams.get("channel")),
    releaseType: typeFromQuery(searchParams.get("type")),
  };
}

export function serializeNewReleaseState(state: NewReleaseState) {
  const params = new URLSearchParams();
  const channel = MARKET_CHANNEL_OPTIONS.find(
    (option) => option.value === state.channel,
  );

  if (channel && channel.value !== DEFAULT_NEW_RELEASE_STATE.channel) {
    params.set("channel", channel.queryValue);
  }
  if (state.releaseType !== DEFAULT_NEW_RELEASE_STATE.releaseType) {
    params.set("type", state.releaseType);
  }

  return params.toString();
}

export function getMarketChannelLabel(channel: MarketChannel) {
  return (
    MARKET_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ??
    MARKET_CHANNEL_OPTIONS[0].label
  );
}

function releaseTypeFor(value: NewReleaseTypeValue): ReleaseType | null {
  return (
    NEW_RELEASE_TYPE_OPTIONS.find((option) => option.value === value)?.releaseType ??
    null
  );
}

export function selectNewReleaseAlbums(
  albums: MockAlbum[],
  sources: MockNewReleaseSourceContext[],
  state: NewReleaseState,
) {
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const matchingSources =
    state.channel === "ALL"
      ? sources
      : sources.filter((source) => source.sourceMarketChannel === state.channel);
  const releaseType = releaseTypeFor(state.releaseType);
  const uniqueAlbumIds = new Set(matchingSources.map((source) => source.albumId));

  return [...uniqueAlbumIds]
    .map((albumId) => albumById.get(albumId))
    .filter((album): album is MockAlbum => album !== undefined)
    .filter((album) => !releaseType || album.releaseType === releaseType)
    .sort(
      (a, b) =>
        b.releaseDate.localeCompare(a.releaseDate) ||
        a.title.localeCompare(b.title, "zh-CN"),
    );
}
