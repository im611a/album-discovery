"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, type ComponentProps, type ReactNode } from "react";

import { buildArtistCollectionAlbumHref } from "@/catalog/artist-collection-navigation";
import { buildArtistCollectionPresentationModel } from "@/catalog/artist-collection-presentation-model";
import { projectArtistCollection } from "@/catalog/artist-collection";
import { catalogAlbums } from "@/catalog/published-catalog";
import type { PublishedArtistIndex } from "@/catalog/schema";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

import { AlbumActions } from "../album-actions";

type ArtistAlbumLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  readonly albumSlug: string;
  readonly children?: ReactNode;
};

function ContextualArtistAlbumLink({ albumSlug, ...props }: ArtistAlbumLinkProps) {
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? "";
  const href = useMemo(() => buildArtistCollectionAlbumHref({
    targetSlug: albumSlug,
    searchParams: query,
    catalog: catalogAlbums,
  }) ?? `/albums/${albumSlug}`, [albumSlug, query]);
  return <Link href={href} {...props} />;
}

export function ArtistCollectionAlbumLink({ albumSlug, ...props }: ArtistAlbumLinkProps) {
  return <Suspense fallback={<Link href={`/albums/${albumSlug}`} {...props} />}>
    <ContextualArtistAlbumLink albumSlug={albumSlug} {...props} />
  </Suspense>;
}

export function ArtistAlbumStateActions({ albumId }: { readonly albumId: string }) {
  return <div className="r16-artist-work-actions"><AlbumActions album={{ id: albumId }} compact /></div>;
}

export function ArtistCollectionExperience({ artist, inline = false }: { readonly artist: PublishedArtistIndex; readonly inline?: boolean }) {
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? "";
  const { state, hydrated } = usePersonalState();
  const model = useMemo(() => {
    if (!hydrated) return null;
    const projection = projectArtistCollection({ artist, catalog: catalogAlbums, state });
    return buildArtistCollectionPresentationModel({ projection, catalog: catalogAlbums, searchParams: query });
  }, [artist, hydrated, query, state]);

  if (!model) {
    return <section className="r16-artist-collection r16-artist-collection--loading" aria-busy="true" aria-label="正在读取当前设备专辑状态"><p>正在读取当前设备上的专辑状态…</p></section>;
  }

  const single = model.collection.mode === "INLINE_SINGLE_WORK";
  const singleWork = single ? model.chronology[0] : null;
  if (inline && singleWork) {
    return <aside className="r16-artist-collection-inline" aria-label="这位艺人与我的专辑" data-album-id={singleWork.albumId}>
      <p className="section-kicker">CURRENT DEVICE / ALBUM STATE</p>
      <p aria-live="polite" aria-atomic="true">{model.collection.summaryCopy}</p>
      <p className="r16-artist-collection-inline__state"><span>{singleWork.status.label}</span>{singleWork.recentlyViewed && singleWork.primaryStatus !== "RECENTLY_VIEWED" ? " · 最近查看" : null}</p>
      <small>{singleWork.status.accessibleLabel}</small>
    </aside>;
  }
  return (
    <section
      className={`r16-artist-collection r16-artist-collection--${single ? "single" : "multi"}`}
      aria-labelledby="artist-collection-title"
      data-collection-mode={model.collection.mode.toLowerCase()}
      data-collection-shape={model.collection.shape.toLowerCase()}
    >
      <header className="r16-artist-collection__header">
        <div>
          <p className="section-kicker">CURRENT DEVICE / ALBUM STATE</p>
          <h2 id="artist-collection-title">{model.collection.heading}</h2>
        </div>
        <p aria-live="polite" aria-atomic="true">{model.collection.summaryCopy}</p>
      </header>
      {model.collection.metrics.length ? <dl className="r16-artist-collection__metrics" aria-label="当前设备专辑状态计数">
        {model.collection.metrics.map((metric) => <div key={metric.key} data-metric={metric.key}><dt>{metric.label}</dt><dd>{metric.count} 张</dd></div>)}
      </dl> : null}
      {singleWork ? <div className="r16-artist-collection__single" data-album-id={singleWork.albumId}>
        <p><span>{singleWork.status.label}</span>{singleWork.recentlyViewed && singleWork.primaryStatus !== "RECENTLY_VIEWED" ? " · 最近查看" : null}</p>
        <small>{singleWork.status.accessibleLabel}</small>
      </div> : null}
      {!single && model.collection.contextualWorks.length ? <ol className="r16-artist-collection__index" aria-label="与当前设备状态相交的作品">
        {model.collection.contextualWorks.map((work, index) => <li key={work.albumId} data-album-id={work.albumId} data-state={work.primaryStatus.toLowerCase()}>
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <Link href={work.href} aria-label={work.accessibleLabel}>{work.title}</Link>
          <span>{work.status.label}{work.recentlyViewed && work.primaryStatus !== "RECENTLY_VIEWED" ? " · 最近查看" : null}</span>
        </li>)}
      </ol> : null}
      {!single && !model.collection.contextualWorks.length ? <p className="r16-artist-collection__empty">作品年表仍完整保留；这里仅记录当前设备上明确的专辑状态。</p> : null}
      <p className="sr-only">{model.accessibility.screenReaderSummary}</p>
    </section>
  );
}
