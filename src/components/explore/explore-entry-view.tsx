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
          <p className="section-kicker">SERENDIPITY / 馆藏偶然入口</p>
          <h2 id="explore-random-result-title">偶然进入一张作品</h2>
        </div>
        <p>当前链接只负责保留这次馆藏入口。这不是相似关系、推荐结论或热度排序。</p>
      </header>
      <Link
        className="r13-explore-entry__primary r13-explore-entry__primary--random"
        href={presentation.href}
        aria-label={`偶然进入《${presentation.target.title}》；这不表示作品关系或个人偏好`}
      >
        <span className="r13-explore-entry__primary-cover"><AlbumCover album={presentation.target} /></span>
        <span className="r13-explore-entry__primary-copy">
          <span className="r13-explore-entry__position">偶然入口 · 非关系结果</span>
          <span className="r13-explore-entry__lens">本次偶然入口</span>
          <h3>{presentation.target.title}</h3>
          <TargetMeta option={{ target: presentation.target }} />
          <span className="r13-explore-entry__reason">这次选择可以随当前链接再次打开；这里不声称它与任何作品相似、相关或符合个人偏好。</span>
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
