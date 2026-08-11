import Link from "next/link";
import type {
  ExplorePresentationOption,
  ExploreRandomPresentation,
  ExploreRelationPresentation,
} from "@/catalog/discovery/explore-entry-presentation";
import { AlbumCover } from "@/components/albums/album-cover";

function TargetMeta({ option }: { option: Pick<ExplorePresentationOption, "target"> }) {
  return (
    <span className="r13-explore-entry__meta">
      <span>{option.target.artists.map((artist) => artist.name).join("、")}</span>
      <span>{option.target.releaseYear ?? "日期暂缺"} · {option.target.releaseTypeLabel}</span>
    </span>
  );
}

function RelationEntryView({ presentation }: { presentation: ExploreRelationPresentation }) {
  return (
    <section
      className="r13-explore-entry r13-explore-entry--relation"
      aria-labelledby="explore-relation-result-title"
      data-explore-authority="relation"
      data-explore-source-kind={presentation.choice.source.kind.toLowerCase()}
    >
      <header className="r13-explore-entry__heading">
        <div>
          <p className="section-kicker">RELATION ENTRY / 可重建证据</p>
          <h2 id="explore-relation-result-title">沿一条真实关系进入</h2>
        </div>
        <p>主入口来自既有 R13 关系与解释系统；刷新不会重排，也不使用热度、个人偏好或随机数。</p>
      </header>

      <div className="r13-explore-entry__source">
        <div><span>{presentation.sourceKindLabel}</span><strong>{presentation.sourceLabel}</strong></div>
        <Link href={presentation.sourceHref}>{presentation.sourceAction} <span aria-hidden="true">→</span></Link>
      </div>

      <Link
        className="r13-explore-entry__primary"
        href={presentation.primary.href}
        aria-label={`从${presentation.sourceLabel}进入《${presentation.primary.target.title}》：${presentation.primary.explanation}`}
      >
        <span className="r13-explore-entry__primary-cover"><AlbumCover album={presentation.primary.target} /></span>
        <span className="r13-explore-entry__primary-copy">
          <span className="r13-explore-entry__position">关系入口 · 首选去向</span>
          <span className="r13-explore-entry__lens">{presentation.primary.lens}</span>
          <h3>{presentation.primary.target.title}</h3>
          <TargetMeta option={presentation.primary} />
          <span className="r13-explore-entry__reason">{presentation.primary.explanation}</span>
          <span className="r13-explore-entry__action">进入专辑并继续发现 <span aria-hidden="true">→</span></span>
        </span>
      </Link>

      {presentation.alternates.length ? (
        <div className="r13-explore-entry__alternates" aria-label="同一入口的其他真实去向">
          <p>同一入口的其他去向</p>
          <ol>
            {presentation.alternates.map((option, index) => (
              <li key={option.target.id}>
                <Link href={option.href} aria-label={`备选 ${index + 1}：《${option.target.title}》；${option.explanation}`}>
                  <span className="r13-explore-entry__alternate-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span className="r13-explore-entry__alternate-cover"><AlbumCover album={option.target} /></span>
                  <span className="r13-explore-entry__alternate-copy">
                    <span className="r13-explore-entry__lens">{option.lens}</span>
                    <h3>{option.target.title}</h3>
                    <TargetMeta option={option} />
                    <span className="r13-explore-entry__reason">{option.explanation}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function RandomEntryView({ presentation }: { presentation: ExploreRandomPresentation }) {
  return (
    <section
      className="r13-explore-entry r13-explore-entry--random"
      aria-labelledby="explore-random-result-title"
      data-explore-authority="serendipity"
    >
      <header className="r13-explore-entry__heading">
        <div>
          <p className="section-kicker">SERENDIPITY / 稳定随机入口</p>
          <h2 id="explore-random-result-title">偶然进入一张作品</h2>
        </div>
        <p>固定种子只负责从馆藏中选择入口。这不是相似关系、推荐结论或热度排序。</p>
      </header>
      <Link
        className="r13-explore-entry__primary r13-explore-entry__primary--random"
        href={presentation.href}
        aria-label={`随机进入《${presentation.target.title}》；固定种子 ${presentation.seed} 不表示作品关系`}
      >
        <span className="r13-explore-entry__primary-cover"><AlbumCover album={presentation.target} /></span>
        <span className="r13-explore-entry__primary-copy">
          <span className="r13-explore-entry__position">偶然入口 · 非关系结果</span>
          <span className="r13-explore-entry__lens">分享种子 {presentation.seed}</span>
          <h3>{presentation.target.title}</h3>
          <TargetMeta option={{ target: presentation.target }} />
          <span className="r13-explore-entry__reason">同一个种子与同一组本机排除状态会得到同一张专辑；这里不声称它与任何作品相似或相关。</span>
          <span className="r13-explore-entry__action">偶然进入这张专辑 <span aria-hidden="true">→</span></span>
        </span>
      </Link>
    </section>
  );
}

export function ExploreEntryView({
  presentation,
}: {
  presentation: ExploreRelationPresentation | ExploreRandomPresentation;
}) {
  return presentation.authority === "RELATION"
    ? <RelationEntryView presentation={presentation} />
    : <RandomEntryView presentation={presentation} />;
}
