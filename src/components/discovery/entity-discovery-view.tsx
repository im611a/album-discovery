import type {
  ArtistDiscoveryPresentation,
  EntityDiscoveryOption,
  TopicDiscoveryPresentation,
} from "@/catalog/discovery/artist-topic-presentation";
import { AlbumCover } from "@/components/albums/album-cover";
import { ReturnContextLink } from "@/components/navigation/return-journey";

type EntityDiscoveryPresentation = ArtistDiscoveryPresentation | TopicDiscoveryPresentation;

function OptionMeta({ option }: { option: EntityDiscoveryOption }) {
  return (
    <p className="r13-entity-discovery__meta">
      <span>{option.target.artists.map((artist) => artist.name).join("、")}</span>
      <span>{option.target.releaseYear ?? "日期暂缺"} · {option.target.releaseTypeLabel}</span>
    </p>
  );
}

function headingCopy(presentation: EntityDiscoveryPresentation) {
  if (presentation.kind === "TOPIC") {
    return {
      kicker: "TOPIC ENTRY / 真实馆藏成员",
      title: "从这一专题继续",
      intro: "专题目录仍是事实主体；这里选择一张真实成员专辑作为继续发现的入口，不代表热度、排名或个性化推荐。",
      action: "从这张专辑进入路径",
    };
  }
  if (presentation.source.shape === "SINGLE_WORK") {
    return {
      kicker: "CATALOG ESCAPE / 单作品艺人",
      title: "从唯一作品向外继续",
      intro: "保留这位艺人的唯一馆藏作品，并从该专辑的真实流派、年代或聆听场景关系进入另一张作品。这里不暗示艺人之间存在合作或私人关联。",
      action: "沿专辑证据继续",
    };
  }
  return {
    kicker: "CHRONOLOGY PATH / 作品年表",
    title: "从作品年表继续",
    intro: "作品年表仍是这页的事实主体；首选去向沿同一艺人的真实发行时间线继续，重复后才由既有发现引擎寻找其他可说明的出口。",
    action: "继续到这张作品",
  };
}

export function EntityDiscoveryView({
  presentation,
}: {
  presentation: EntityDiscoveryPresentation;
}) {
  const copy = headingCopy(presentation);
  const titleId = presentation.kind === "ARTIST"
    ? "artist-continuation-title"
    : "topic-continuation-title";
  const sourceKey = presentation.kind === "ARTIST"
    ? presentation.source.slug
    : presentation.source.key;
  return (
    <section
      className={`r13-entity-discovery r13-entity-discovery--${presentation.kind.toLowerCase()}`}
      aria-labelledby={titleId}
      data-discovery-entity={presentation.kind.toLowerCase()}
      data-discovery-source={sourceKey}
    >
      <header className="r13-entity-discovery__heading">
        <p className="section-kicker">{copy.kicker}</p>
        <h2 id={titleId}>{copy.title}</h2>
      </header>

      {presentation.path.active ? (
        <nav className="r13-entity-discovery__path" aria-label="当前发现路径">
          <p>
            <span>当前路径</span>
            {presentation.path.previousAlbumTitle
              ? <>从《{presentation.path.previousAlbumTitle}》进入这里</>
              : presentation.path.entryLabel
                ? <>起点：{presentation.path.entryLabel}</>
                : <>沿当前目录线索继续</>}
          </p>
          <ReturnContextLink href={presentation.path.resetHref}>从本页重新开始</ReturnContextLink>
        </nav>
      ) : null}

      <p className="r13-entity-discovery__intro">{copy.intro}</p>

      <ReturnContextLink
        className="r13-entity-discovery__primary"
        href={presentation.primary.href}
        aria-label={`${copy.action}《${presentation.primary.target.title}》：${presentation.primary.explanation}`}
      >
        <span className="r13-entity-discovery__primary-cover">
          <AlbumCover album={presentation.primary.target} />
        </span>
        <span className="r13-entity-discovery__primary-copy">
          <span className="r13-entity-discovery__position">首选去向</span>
          <span className="r13-entity-discovery__lens">{presentation.primary.lens}</span>
          <h3>{presentation.primary.target.title}</h3>
          <OptionMeta option={presentation.primary} />
          <span className="r13-entity-discovery__reason">{presentation.primary.explanation}</span>
          <span className="r13-entity-discovery__action">{copy.action} <span aria-hidden="true">→</span></span>
        </span>
      </ReturnContextLink>

      {presentation.alternates.length ? (
        <div className="r13-entity-discovery__alternates" aria-label="其他可说明的发现去向">
          <p className="r13-entity-discovery__alternates-label">其他入口</p>
          <ol>
            {presentation.alternates.map((option, index) => (
              <li key={option.target.id}>
                <ReturnContextLink
                  href={option.href}
                  aria-label={`备选 ${index + 1}：《${option.target.title}》；${option.explanation}`}
                >
                  <span className="r13-entity-discovery__alternate-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="r13-entity-discovery__alternate-cover">
                    <AlbumCover album={option.target} />
                  </span>
                  <span className="r13-entity-discovery__alternate-copy">
                    <span className="r13-entity-discovery__lens">{option.lens}</span>
                    <h3>{option.target.title}</h3>
                    <OptionMeta option={option} />
                    <span className="r13-entity-discovery__reason">{option.explanation}</span>
                  </span>
                </ReturnContextLink>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
