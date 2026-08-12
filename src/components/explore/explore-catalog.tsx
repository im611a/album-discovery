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
import { PersonalJourneySurface } from "@/components/personalization/personal-journey-surface";

const MODES = [
  ["genre", "流派漫游"],
  ["decade", "年代穿梭"],
  ["scene", "聆听场景"],
  ["artist", "艺人接力"],
  ["personal", "个人路径"],
  ["random", "随机一张"],
] as const;
type ExploreMode = typeof MODES[number][0];
const RELATION_MODES: readonly ExploreRelationMode[] = ["genre", "decade", "scene", "artist"];

export function ExploreCatalog() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, hydrated } = usePersonalState();
  const requestedMode = params.get("mode");
  const mode = (MODES.some(([value]) => value === requestedMode) ? requestedMode : "genre") as ExploreMode;
  const relationMode = RELATION_MODES.includes(mode as ExploreRelationMode) ? mode as ExploreRelationMode : null;
  const sourceOptions = relationMode ? getExploreRelationChoices(relationMode) : [];
  const choice = relationMode
    ? resolveExploreRelationChoice(relationMode, params.get("value"), params.get("kind"))
    : null;
  const seed = params.get("seed")?.slice(0, 64) || "12345";
  const dismissed = hydrated ? state.dismissedAlbumIds : [];
  const presentation = mode === "random"
    ? buildExploreRandomPresentation(seed, dismissed)
    : relationMode && choice
      ? buildExploreRelationPresentation(choice)
      : null;

  function setSelection(nextMode: ExploreMode, nextToken?: string) {
    const next = new URLSearchParams();
    next.set("mode", nextMode);
    if (nextMode === "random") next.set("seed", nextToken || "12345");
    else if (RELATION_MODES.includes(nextMode as ExploreRelationMode) && nextToken) {
      const selected = getExploreRelationChoices(nextMode as ExploreRelationMode).find((option) => option.token === nextToken);
      if (selected) {
        next.set("value", selected.value);
        if (selected.kind) next.set("kind", selected.kind);
      }
    }
    router.push(`/explore?${next}`, { scroll: false });
  }

  return <div className="explore-catalog pa-relation-path" data-explore-mode={mode}>
    <nav className="explore-modes" aria-label="探索模式">
      {MODES.map(([value, label]) => <Link key={value} data-explore-authority={value === "personal" ? "personal" : value === "random" ? "serendipity" : "relation"} href={value === "random" ? "/explore?mode=random&seed=12345" : `/explore?mode=${value}`} aria-current={mode === value ? "page" : undefined}>{label}</Link>)}
    </nav>
    <div className="r13-explore-authority" aria-label="入口类型说明">
      <p><strong>关系入口</strong><span>由真实目录关系与统一解释系统决定</span></p>
      <p><strong>个人入口</strong><span>仅由当前设备上的明确口味、保存与浏览线索决定</span></p>
      <p><strong>偶然入口</strong><span>由可复现的馆藏抽取决定，不表示任何关系</span></p>
    </div>
    {relationMode && choice ? <div className="explore-control">
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
    </div> : mode === "random" ? <div className="explore-control explore-control--random">
      <div className="explore-control__serendipity-copy"><strong>偶然进入馆藏</strong><p>当前链接会保留这次选择，便于返回或分享；随机只选择入口，不制造关系。</p></div>
      <button className="button button--secondary" type="button" onClick={() => setSelection("random", String(Date.now()))}>再随机一张</button>
    </div> : <div className="explore-control r14-explore-personal-control"><p><strong>当前设备的个人路径</strong><br />只使用你明确留下的本机线索；浏览不等于听过，也不会被包装成远程 AI 推荐。</p></div>}
    <div className="pa-relation-path__line" aria-hidden="true"><span>选择入口</span><i /><span>{mode === "random" ? "偶然" : mode === "personal" ? "本机个人线索" : "真实关系"}</span><i /><span>进入馆藏</span></div>
    <div aria-live="polite">
      {mode === "personal"
        ? <PersonalJourneySurface context="EXPLORE" source="explore" eyebrow="PERSONAL ENTRY / LOCAL ONLY" title="沿你的本机线索开始" className="r14-explore-journey" limit={8} />
        : presentation
        ? <ExploreEntryView presentation={presentation} />
        : <div className="empty-state"><h2>当前没有可用入口</h2><p>请选择另一个真实存在的入口。</p></div>}
    </div>
  </div>;
}
