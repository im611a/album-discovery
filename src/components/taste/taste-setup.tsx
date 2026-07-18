"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { catalogAlbums, catalogTaxonomy } from "@/catalog/published-catalog";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";
import type { TasteProfile } from "@/features/personal-state/schema";

const contexts = ["专注聆听", "通勤", "夜晚", "放松", "工作", "运动", "独处", "周末"];
const seedAlbums = catalogAlbums.filter((album) => album.editorial).slice(0, 8);
const toggle = (items: string[], value: string, maximum = Infinity) => items.includes(value) ? items.filter((item) => item !== value) : items.length < maximum ? [...items, value] : items;

export function TasteSetup({ embedded = false }: { embedded?: boolean }) {
  const { state, saveTaste } = usePersonalState();
  const router = useRouter();
  const [taste, setTaste] = useState<TasteProfile>(state.taste);
  const signals = taste.genres.length + taste.descriptors.length;
  const summary = useMemo(() => [taste.genres.map((key) => catalogTaxonomy.find((item) => item.key === key)?.labelZh).filter(Boolean).join("、"), taste.contexts.join("、"), taste.exploration === "familiar" ? "偏熟悉" : taste.exploration === "exploratory" ? "偏探索" : "熟悉与探索平衡"].filter(Boolean).join(" · "), [taste]);
  function finish() { saveTaste(taste, true); router.push("/for-you"); }
  return <section className={embedded ? "taste-setup taste-setup--embedded" : "taste-setup"} aria-labelledby="taste-title">
    <div className="section-kicker">不到一分钟</div>
    <h2 id="taste-title">先告诉我们你想听什么</h2>
    <p>选择 2–5 个类型信号，也可以加入熟悉的种子专辑。数据只保存在这台设备。</p>
    <fieldset><legend>类型偏好 <span>{signals}/5</span></legend><div className="choice-grid">{catalogTaxonomy.map((item) => <button type="button" key={item.key} aria-pressed={taste.genres.includes(item.key)} onClick={() => setTaste((current) => ({ ...current, genres: toggle(current.genres, item.key, 5) }))}>{item.labelZh}</button>)}</div></fieldset>
    <fieldset><legend>常见聆听场景</legend><div className="choice-grid choice-grid--compact">{contexts.map((context) => <button type="button" key={context} aria-pressed={taste.contexts.includes(context)} onClick={() => setTaste((current) => ({ ...current, contexts: toggle(current.contexts, context, 4) }))}>{context}</button>)}</div></fieldset>
    {!embedded ? <fieldset><legend>可选：从熟悉的专辑出发</legend><div className="seed-grid">{seedAlbums.map((album) => <button type="button" key={album.id} aria-pressed={taste.seedAlbumIds.includes(album.id)} onClick={() => setTaste((current) => ({ ...current, seedAlbumIds: toggle(current.seedAlbumIds, album.id, 3) }))}><strong>{album.title}</strong><span>{album.artists[0]?.name}</span></button>)}</div></fieldset> : null}
    <fieldset><legend>推荐取向</legend><div className="segmented-control">{([["familiar", "更熟悉"], ["balanced", "平衡"], ["exploratory", "更多探索"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={taste.exploration === value} onClick={() => setTaste((current) => ({ ...current, exploration: value }))}>{label}</button>)}</div></fieldset>
    {summary ? <p className="taste-summary"><strong>当前口味：</strong>{summary}</p> : null}
    <div className="form-actions"><button type="button" className="button button--primary" disabled={signals < 2} onClick={finish}>查看我的推荐</button><button type="button" className="button button--quiet" onClick={() => { saveTaste(taste, true); router.push("/for-you"); }}>跳过设置</button></div>
  </section>;
}
