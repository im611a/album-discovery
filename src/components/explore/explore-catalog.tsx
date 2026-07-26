"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlbumGrid } from "@/components/album-grid";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";
import { albumDecade, buildExploreOptions, getArtistRelayAlbums, getSeededRandomAlbum } from "@/catalog/exploration";
import { catalogAlbums } from "@/catalog/published-catalog";

const MODES = [
  ["genre", "流派漫游"],
  ["decade", "年代穿梭"],
  ["scene", "聆听场景"],
  ["artist", "艺人接力"],
  ["random", "随机一张"],
] as const;
type ExploreMode = typeof MODES[number][0];
const options = buildExploreOptions();

export function ExploreCatalog() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, hydrated } = usePersonalState();
  const requestedMode = params.get("mode");
  const mode = (MODES.some(([value]) => value === requestedMode) ? requestedMode : "genre") as ExploreMode;
  const genreOptions = [...options.coreGenres, ...options.relatedGenres.filter((item) => !options.coreGenres.some((core) => core.value === item.value))];
  const sourceOptions = mode === "genre" ? genreOptions : mode === "decade" ? options.decades : mode === "scene" ? options.scenes : mode === "artist" ? options.artists : [];
  const requestedValue = params.get("value");
  const value = sourceOptions.find((item) => item.value === requestedValue)?.value ?? sourceOptions[0]?.value ?? "";
  const seed = params.get("seed")?.slice(0, 64) || "12345";
  const dismissed = hydrated ? state.dismissedAlbumIds : [];
  const filtered = mode === "genre"
    ? catalogAlbums.filter((album) => album.coreGenres.includes(value) || album.relatedGenres.includes(value))
    : mode === "decade"
      ? catalogAlbums.filter((album) => albumDecade(album) === value)
      : mode === "scene"
        ? catalogAlbums.filter((album) => album.contexts.includes(value))
        : mode === "artist"
          ? getArtistRelayAlbums(value)
          : [];
  const results = filtered.filter((album) => !dismissed.includes(album.id));
  const randomAlbum = mode === "random" ? getSeededRandomAlbum(seed, catalogAlbums, dismissed) : null;
  const randomReasons = randomAlbum ? { [randomAlbum.id]: `分享种子 ${seed} 在当前目录中得到的稳定结果。` } : undefined;

  function setSelection(nextMode: ExploreMode, nextValue?: string) {
    const next = new URLSearchParams();
    next.set("mode", nextMode);
    if (nextMode === "random") next.set("seed", nextValue || "12345");
    else if (nextValue) next.set("value", nextValue);
    router.push(`/explore?${next}`, { scroll: false });
  }

  return <div className="explore-catalog pa-relation-path" data-explore-mode={mode}>
    <nav className="explore-modes" aria-label="探索模式">
      {MODES.map(([value, label]) => <Link key={value} href={value === "random" ? "/explore?mode=random&seed=12345" : `/explore?mode=${value}`} aria-current={mode === value ? "page" : undefined}>{label}</Link>)}
    </nav>
    {mode !== "random" ? <div className="explore-control">
      <label>{MODES.find(([key]) => key === mode)?.[1]}
        <select value={value} onChange={(event) => setSelection(mode, event.target.value)}>
          {sourceOptions.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.count} 张</option>)}
        </select>
      </label>
      {mode === "scene" ? <p>聆听场景是本站策展维度，不是 RYM 分类。</p> : mode === "artist" ? <p>从该艺人的目录流派出发，接力到不同艺人的真实专辑。</p> : null}
    </div> : <div className="explore-control explore-control--random">
      <label>分享种子<input value={seed} maxLength={64} onChange={(event) => setSelection("random", event.target.value || "12345")} /></label>
      <button className="button button--secondary" type="button" onClick={() => setSelection("random", String(Date.now()))}>换一个种子</button>
      <p>相同种子始终得到同一张专辑；不感兴趣状态只在本机参与排除，不写入 URL。</p>
    </div>}
    <div className="pa-relation-path__line" aria-hidden="true"><span>种子</span><i /><span>关系</span><i /><span>下一张</span></div>
    <div className="results-bar"><p aria-live="polite">{mode === "random" ? (randomAlbum ? "1 张稳定随机结果" : "当前没有可用结果") : `${results.length} 张专辑`}</p></div>
    {mode === "random"
      ? randomAlbum ? <AlbumGrid albums={[randomAlbum]} reasons={randomReasons} /> : <div className="empty-state"><h2>当前没有可探索专辑</h2></div>
      : results.length ? <AlbumGrid albums={results} /> : <div className="empty-state"><h2>当前路径没有专辑</h2><p>请选择另一个真实存在的入口。</p></div>}
  </div>;
}
