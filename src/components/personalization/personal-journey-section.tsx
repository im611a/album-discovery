import Link from "next/link";
import { AlbumCover } from "@/components/albums/album-cover";
import { AlbumActions } from "@/components/album-actions";
import type { PersonalJourneyOption, PersonalJourneyPresentation } from "@/catalog/personalization";
import { ReturnContextLink } from "@/components/navigation/return-journey";
import { RELEASE_TYPE_LABELS } from "@/catalog/schema";

function JourneyCard({ option, emphasis = false, forYou = false, onNext, onAdjustTaste }: { option: PersonalJourneyOption; emphasis?: boolean; forYou?: boolean; onNext?: () => void; onAdjustTaste?: () => void }) {
  return <article className="r14-journey-card" data-provenance={option.provenance} data-emphasis={emphasis ? "primary" : "supporting"} data-for-you-card={forYou ? (emphasis ? "primary" : "alternative") : undefined}>
    <ReturnContextLink className="r14-journey-card__cover" href={option.href} aria-label={`查看《${option.album.title}》专辑导览：${option.lens}`}>
      <AlbumCover album={option.album} />
    </ReturnContextLink>
    <div className="r14-journey-card__copy">
      {!forYou ? <p className="r14-journey-card__authority">{option.provenance === "PERSONAL" ? "本机个人线索" : "目录关系补充"}</p> : null}
      <h3><ReturnContextLink href={option.href}>{option.album.title}</ReturnContextLink></h3>
      <p className="r14-journey-card__artist">{option.album.artists.map((artist) => artist.name).join("、")}</p>
      {forYou ? <p className="r14-journey-card__meta">{option.album.releaseYear ?? "日期暂缺"} · {RELEASE_TYPE_LABELS[option.album.albumType]}</p> : <p className="r14-journey-card__lens">{option.lens}</p>}
      {emphasis || !forYou ? <p className="r14-journey-card__explanation">{option.explanation}</p> : null}
      {forYou && emphasis ? <div className="ux-for-you-primary-actions"><ReturnContextLink href={option.href}>查看专辑</ReturnContextLink><button type="button" onClick={onNext}>换一张</button><button type="button" aria-controls="for-you-taste-settings" onClick={onAdjustTaste}>调整口味</button></div> : <ReturnContextLink className="r14-journey-card__continue" href={option.href}>{forYou ? "查看专辑" : "沿这条线索继续"} <span aria-hidden="true">→</span></ReturnContextLink>}
      {!forYou ? <AlbumActions album={option.album} compact /> : null}
    </div>
  </article>;
}

export function PersonalJourneySection({ presentation, title, eyebrow, className = "", forYou = false, activeIndex = 0, onNext, onAdjustTaste }: {
  presentation: PersonalJourneyPresentation;
  title: string;
  eyebrow: string;
  className?: string;
  forYou?: boolean;
  activeIndex?: number;
  onNext?: () => void;
  onAdjustTaste?: () => void;
}) {
  const options = presentation.primary
    ? [presentation.primary, ...presentation.secondary, ...presentation.fallback]
      .filter((option, index, values) => values.findIndex((candidate) => candidate.album.id === option.album.id) === index)
    : [];
  const primaryIndex = options.length ? activeIndex % options.length : 0;
  const primary = options[primaryIndex];
  const supporting = options.filter((_, index) => index !== primaryIndex);
  const supportLimit = presentation.context === "FOR_YOU" ? 5 : 3;
  return <section className={`r14-personal-journey ${className}`.trim()} data-personal-status={presentation.status} aria-labelledby={`r14-${presentation.context.toLowerCase()}-journey-title`}>
    <header className="r14-personal-journey__header">
      <div><p className="section-kicker">{eyebrow}</p><h2 id={`r14-${presentation.context.toLowerCase()}-journey-title`}>{title}</h2></div>
      <p>{presentation.summary}</p>
    </header>
    {options.length ? <div className="r14-personal-journey__layout">
      <JourneyCard option={primary!} emphasis forYou={forYou} onNext={onNext} onAdjustTaste={onAdjustTaste} />
      {supporting.length ? <div className="r14-personal-journey__support" aria-label={forYou ? "其他推荐" : "后续个人路径"}>{supporting.slice(0, supportLimit).map((option) => <JourneyCard key={option.album.id} option={option} forYou={forYou} />)}</div> : null}
    </div> : <div className="r14-personal-journey__empty">
      <p>这里没有足够的个人线索，因此不会伪装成“为你推荐”。你仍可从真实馆藏或关系探索开始。</p>
      <nav aria-label="个人路径起点">{presentation.ctas.map((cta) => <Link key={cta.href} href={cta.href}>{cta.label}</Link>)}</nav>
    </div>}
  </section>;
}
