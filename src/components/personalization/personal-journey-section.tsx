import Link from "next/link";
import { AlbumCover } from "@/components/albums/album-cover";
import { AlbumActions } from "@/components/album-actions";
import type { PersonalJourneyOption, PersonalJourneyPresentation } from "@/catalog/personalization";
import { ReturnContextLink } from "@/components/navigation/return-journey";

function JourneyCard({ option, emphasis = false }: { option: PersonalJourneyOption; emphasis?: boolean }) {
  return <article className="r14-journey-card" data-provenance={option.provenance} data-emphasis={emphasis ? "primary" : "supporting"}>
    <ReturnContextLink className="r14-journey-card__cover" href={option.href} aria-label={`查看《${option.album.title}》专辑导览：${option.lens}`}>
      <AlbumCover album={option.album} />
    </ReturnContextLink>
    <div className="r14-journey-card__copy">
      <p className="r14-journey-card__authority">{option.provenance === "PERSONAL" ? "本机个人线索" : "目录关系补充"}</p>
      <h3><ReturnContextLink href={option.href}>{option.album.title}</ReturnContextLink></h3>
      <p className="r14-journey-card__artist">{option.album.artists.map((artist) => artist.name).join("、")}</p>
      <p className="r14-journey-card__lens">{option.lens}</p>
      <p className="r14-journey-card__explanation">{option.explanation}</p>
      <ReturnContextLink className="r14-journey-card__continue" href={option.href}>沿这条线索继续 <span aria-hidden="true">→</span></ReturnContextLink>
      <AlbumActions album={option.album} compact />
    </div>
  </article>;
}

export function PersonalJourneySection({ presentation, title, eyebrow, className = "" }: {
  presentation: PersonalJourneyPresentation;
  title: string;
  eyebrow: string;
  className?: string;
}) {
  const options = presentation.primary
    ? [presentation.primary, ...presentation.secondary, ...presentation.fallback]
      .filter((option, index, values) => values.findIndex((candidate) => candidate.album.id === option.album.id) === index)
    : [];
  const supportLimit = presentation.context === "FOR_YOU" ? 6 : 4;
  return <section className={`r14-personal-journey ${className}`.trim()} data-personal-status={presentation.status} aria-labelledby={`r14-${presentation.context.toLowerCase()}-journey-title`}>
    <header className="r14-personal-journey__header">
      <div><p className="section-kicker">{eyebrow}</p><h2 id={`r14-${presentation.context.toLowerCase()}-journey-title`}>{title}</h2></div>
      <p>{presentation.summary}</p>
    </header>
    {options.length ? <div className="r14-personal-journey__layout">
      <JourneyCard option={options[0]} emphasis />
      {options.length > 1 ? <div className="r14-personal-journey__support" aria-label="后续个人路径">{options.slice(1, supportLimit).map((option) => <JourneyCard key={option.album.id} option={option} />)}</div> : null}
    </div> : <div className="r14-personal-journey__empty">
      <p>这里没有足够的个人线索，因此不会伪装成“为你推荐”。你仍可从真实馆藏或关系探索开始。</p>
      <nav aria-label="个人路径起点">{presentation.ctas.map((cta) => <Link key={cta.href} href={cta.href}>{cta.label}</Link>)}</nav>
    </div>}
  </section>;
}
