import type { AlbumDiscoveryPresentation } from "@/catalog/discovery/presentation";
import { AlbumCover } from "@/components/albums/album-cover";
import { ReturnContextLink } from "@/components/navigation/return-journey";

function DiscoveryMeta({ option }: { option: AlbumDiscoveryPresentation["alternates"][number] }) {
  return (
    <p className="r13-discovery__meta">
      <span>{option.target.artists.map((artist) => artist.name).join("、")}</span>
      <span>{option.target.releaseYear ?? "日期暂缺"} · {option.target.releaseTypeLabel}</span>
    </p>
  );
}

export function AlbumDiscoveryView({ presentation }: { presentation: AlbumDiscoveryPresentation }) {
  if (!presentation.primary) return null;
  const { primary } = presentation;
  return (
    <section
      className="related-section pa-album-recommendations r13-discovery"
      aria-labelledby="album-recommendations-title"
      data-discovery-source={presentation.source.slug}
      data-discovery-primary={primary.target.slug}
    >
      <header className="r12-detail-section-heading">
        <span aria-hidden="true">05B</span>
        <div>
          <p className="section-kicker">EXPLAINABLE PATH / 本地目录线索</p>
          <h2 id="album-recommendations-title">继续发现</h2>
        </div>
      </header>

      {presentation.path.active ? (
        <nav className="r13-discovery__path" aria-label="当前发现路径">
          <p>
            <span>当前路径</span>
            {presentation.path.previousAlbumTitle
              ? <>从《{presentation.path.previousAlbumTitle}》继续到这里</>
              : presentation.path.entryLabel
                ? <>起点：{presentation.path.entryLabel}</>
                : <>沿当前目录线索继续</>}
          </p>
          <ReturnContextLink href={presentation.path.resetHref}>从本专辑重新开始</ReturnContextLink>
        </nav>
      ) : null}

      <p className="r13-discovery__intro">
        下面的去向只使用本地目录中可说明的创作者、流派、年代与聆听场景关系；首选与备选顺序由同一发现引擎生成。
      </p>

      <ReturnContextLink
        className="r13-discovery__primary"
        href={primary.href}
        aria-label={`继续发现《${primary.target.title}》：${primary.explanation}`}
      >
        <span className="r13-discovery__primary-cover">
          <AlbumCover album={primary.target} />
        </span>
        <span className="r13-discovery__primary-copy">
          <span className="r13-discovery__position">首选去向</span>
          <span className="r13-discovery__lens">{primary.lens}</span>
          <h3>{primary.target.title}</h3>
          <DiscoveryMeta option={primary} />
          <span className="r13-discovery__reason">{primary.explanation}</span>
          <span className="r13-discovery__action">继续到这张专辑 <span aria-hidden="true">→</span></span>
        </span>
      </ReturnContextLink>

      {presentation.alternates.length ? (
        <div className="r13-discovery__alternates" aria-label="其他可说明的发现去向">
          <p className="r13-discovery__alternates-label">其他路径</p>
          <ol>
            {presentation.alternates.map((option, index) => (
              <li key={option.target.id}>
                <ReturnContextLink
                  href={option.href}
                  aria-label={`备选 ${index + 1}：《${option.target.title}》；${option.explanation}`}
                >
                  <span className="r13-discovery__alternate-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="r13-discovery__alternate-cover">
                    <AlbumCover album={option.target} />
                  </span>
                  <span className="r13-discovery__alternate-copy">
                    <span className="r13-discovery__lens">{option.lens}</span>
                    <h3>{option.target.title}</h3>
                    <DiscoveryMeta option={option} />
                    <span className="r13-discovery__reason">{option.explanation}</span>
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
