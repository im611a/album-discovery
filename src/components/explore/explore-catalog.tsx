"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";
import {
  buildExploreRandomPresentation,
  buildExploreRelationPresentation,
  getExploreRelationChoices,
  resolveExploreRelationChoice,
  type ExploreRelationMode,
} from "@/catalog/discovery/explore-entry-presentation";
import { ExploreEntryView } from "./explore-entry-view";

const MODES = [
  ["genre", "流派漫游"],
  ["decade", "年代穿梭"],
  ["scene", "聆听场景"],
  ["artist", "艺人接力"],
  ["random", "随机一张"],
] as const;
type ExploreMode = typeof MODES[number][0];

export function ExploreCatalog() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, hydrated } = usePersonalState();
  const requestedMode = params.get("mode");
  const mode = (MODES.some(([value]) => value === requestedMode) ? requestedMode : "genre") as ExploreMode;
  const relationMode = mode === "random" ? null : mode as ExploreRelationMode;
  const sourceOptions = relationMode ? getExploreRelationChoices(relationMode) : [];
  const choice = relationMode
    ? resolveExploreRelationChoice(relationMode, params.get("value"), params.get("kind"))
    : null;
  const seed = params.get("seed")?.slice(0, 64) || "12345";
  const dismissed = hydrated ? state.dismissedAlbumIds : [];
  const presentation = mode === "random"
    ? buildExploreRandomPresentation(seed, dismissed)
    : choice
      ? buildExploreRelationPresentation(choice)
      : null;

  function setSelection(nextMode: ExploreMode, nextToken?: string) {
    const next = new URLSearchParams();
    next.set("mode", nextMode);
    if (nextMode === "random") next.set("seed", nextToken || "12345");
    else if (nextToken) {
      const selected = getExploreRelationChoices(nextMode).find((option) => option.token === nextToken);
      if (selected) {
        next.set("value", selected.value);
        if (selected.kind) next.set("kind", selected.kind);
      }
    }
    router.push(`/explore?${next}`, { scroll: false });
  }

  return <div className="explore-catalog pa-relation-path" data-explore-mode={mode}>
    <nav className="explore-modes" aria-label="探索模式">
      {MODES.map(([value, label]) => <Link key={value} href={value === "random" ? "/explore?mode=random&seed=12345" : `/explore?mode=${value}`} aria-current={mode === value ? "page" : undefined}>{label}</Link>)}
    </nav>
    <div className="r13-explore-authority" aria-label="入口类型说明">
      <p><strong>关系入口</strong><span>由真实目录关系与统一解释系统决定</span></p>
      <p><strong>偶然入口</strong><span>由固定随机种子选择，不表示任何关系</span></p>
    </div>
    {mode !== "random" && choice ? <div className="explore-control">
      <label>{MODES.find(([key]) => key === mode)?.[1]}
        <select value={choice.token} onChange={(event) => setSelection(mode, event.target.value)}>
          {sourceOptions.map((item) => <option key={item.token} value={item.token}>{item.label} · {item.count} 张</option>)}
        </select>
      </label>
      <p>{mode === "scene"
        ? "聆听场景是本站策展维度，不是 RYM 分类。"
        : mode === "artist"
          ? "从真实艺人作品档案进入；单作品艺人的出口仍由专辑关系解释。"
          : "选择一个真实目录身份，首选去向由统一关系引擎确定。"}</p>
    </div> : <div className="explore-control explore-control--random">
      <label>分享种子<input value={seed} maxLength={64} onChange={(event) => setSelection("random", event.target.value || "12345")} /></label>
      <button className="button button--secondary" type="button" onClick={() => setSelection("random", String(Date.now()))}>换一个种子</button>
      <p>相同种子与同一组本机排除状态始终得到同一张专辑；随机只选择入口，不制造关系。</p>
    </div>}
    <div className="pa-relation-path__line" aria-hidden="true"><span>选择入口</span><i /><span>{mode === "random" ? "偶然" : "真实关系"}</span><i /><span>进入馆藏</span></div>
    <div aria-live="polite">
      {presentation
        ? <ExploreEntryView presentation={presentation} />
        : <div className="empty-state"><h2>当前没有可用入口</h2><p>请选择另一个真实存在的入口。</p></div>}
    </div>
  </div>;
}
