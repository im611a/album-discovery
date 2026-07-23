"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { catalogAlbums, catalogTaxonomy, descriptorTaxonomy } from "@/catalog/published-catalog";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";
import type { TasteProfile } from "@/features/personal-state/schema";

const contexts = ["专注聆听", "通勤", "夜晚", "放松", "工作", "运动", "独处", "周末"];
const descriptorChoices = ["layered", "hazy", "spacious", "melodic", "narrative", "immersive", "improvised", "groovy", "intimate", "intense", "bright", "gradual"];
const eras = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
const seedAlbums = catalogAlbums.filter((album) => album.editorial).slice(0, 8);
const coreTaxonomy = catalogTaxonomy.filter((item) => item.kind === "core");
const toggle = (items: string[], value: string, maximum = Infinity) => items.includes(value) ? items.filter((item) => item !== value) : items.length < maximum ? [...items, value] : items;

export function TasteSetup({ embedded = false, redirectTo = "/for-you" }: { embedded?: boolean; redirectTo?: string | null }) {
  const { state, hydrated, saveTaste } = usePersonalState();
  if (!hydrated) return <p className="status-message">正在读取本机口味…</p>;
  return <TasteSetupForm key={JSON.stringify(state.taste)} initialTaste={state.taste} embedded={embedded} redirectTo={redirectTo} onSave={saveTaste} />;
}

function TasteSetupForm({ initialTaste, embedded, redirectTo, onSave }: { initialTaste: TasteProfile; embedded: boolean; redirectTo: string | null; onSave: (taste: TasteProfile, completed?: boolean) => void }) {
  const router = useRouter();
  const [taste, setTaste] = useState<TasteProfile>(initialTaste);
  const signals = taste.genres.length + taste.descriptors.length;
  const summary = useMemo(() => [taste.genres.map((key) => coreTaxonomy.find((item) => item.key === key)).filter(Boolean).map((item) => `${item?.labelZh}（${item?.labelEn}）`).join("、"), taste.descriptors.map((key) => descriptorTaxonomy.find((item) => item.key === key)?.label ?? key).join("、"), taste.contexts.join("、"), taste.eras.map((era) => era.replace("s", " 年代")).join("、"), taste.exploration === "familiar" ? "偏熟悉" : taste.exploration === "exploratory" ? "偏探索" : "熟悉与探索平衡"].filter(Boolean).join(" · "), [taste]);
  const save = (allowEmpty = false) => { if (!allowEmpty && signals < 2) return; onSave(taste, true); if (redirectTo) router.push(redirectTo); };
  const updateSignal = (key: "genres" | "descriptors", value: string) => setTaste((current) => {
    const currentSignals = current.genres.length + current.descriptors.length;
    if (!current[key].includes(value) && currentSignals >= 5) return current;
    return { ...current, [key]: toggle(current[key], value) };
  });
  return <section className={embedded ? "taste-setup taste-setup--embedded" : "taste-setup"} aria-labelledby="taste-title">
    <div className="section-kicker">不到一分钟</div><h2 id="taste-title">先告诉我们你想听什么</h2><p>选择 2–5 个类型或声音信号，也可以加入熟悉的种子专辑。数据只保存在这台设备。</p>
    <fieldset><legend>核心流派偏好 <span>{signals}/5</span></legend><div className="choice-grid">{coreTaxonomy.map((item) => <button type="button" key={item.key} aria-pressed={taste.genres.includes(item.key)} onClick={() => updateSignal("genres", item.key)}>{item.labelZh}（{item.labelEn}）</button>)}</div></fieldset>
    <fieldset><legend>氛围与特征</legend><div className="choice-grid choice-grid--compact">{descriptorChoices.map((key) => <button type="button" key={key} aria-pressed={taste.descriptors.includes(key)} onClick={() => updateSignal("descriptors", key)}>{descriptorTaxonomy.find((item) => item.key === key)?.label ?? key}</button>)}</div></fieldset>
    <fieldset><legend>常见聆听场景</legend><div className="choice-grid choice-grid--compact">{contexts.map((context) => <button type="button" key={context} aria-pressed={taste.contexts.includes(context)} onClick={() => setTaste((current) => ({ ...current, contexts: toggle(current.contexts, context, 4) }))}>{context}</button>)}</div></fieldset>
    {!embedded ? <><fieldset><legend>可选年代</legend><div className="choice-grid choice-grid--compact">{eras.map((era) => <button type="button" key={era} aria-pressed={taste.eras.includes(era)} onClick={() => setTaste((current) => ({ ...current, eras: toggle(current.eras, era, 3) }))}>{era.replace("s", " 年代")}</button>)}</div></fieldset><fieldset><legend>可选：从熟悉的专辑出发</legend><div className="seed-grid">{seedAlbums.map((album) => <button type="button" key={album.id} aria-pressed={taste.seedAlbumIds.includes(album.id)} onClick={() => setTaste((current) => ({ ...current, seedAlbumIds: toggle(current.seedAlbumIds, album.id, 3) }))}><strong>{album.title}</strong><span>{album.artists[0]?.name}</span></button>)}</div></fieldset></> : null}
    <fieldset><legend>推荐取向</legend><div className="segmented-control">{([["familiar", "更熟悉"], ["balanced", "平衡"], ["exploratory", "更多探索"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={taste.exploration === value} onClick={() => setTaste((current) => ({ ...current, exploration: value }))}>{label}</button>)}</div></fieldset>
    {summary ? <p className="taste-summary"><strong>当前口味：</strong>{summary}</p> : null}
    <div className="form-actions"><button type="button" className="button button--primary" disabled={signals < 2} onClick={() => save()}>{redirectTo ? "查看我的推荐" : "保存口味"}</button>{redirectTo ? <button type="button" className="button button--quiet" onClick={() => save(true)}>跳过设置</button> : null}</div>
  </section>;
}
