"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { buildLibraryProjection, parseLibraryQuery, serializeLibraryQuery, type LibraryQuery } from "@/catalog/collection-presentation";
import { buildLibraryPresentationModel, type LibraryAlbumCardPresentation, type LibraryEmptyStatePresentation } from "@/catalog/library-presentation-model";
import { catalogAlbums } from "@/catalog/published-catalog";
import { AlbumActions } from "@/components/album-actions";
import { AlbumCover } from "@/components/albums/album-cover";
import { usePersonalState } from "@/features/personal-state/personal-state-provider";

function libraryHref(query: LibraryQuery) {
  const serialized = serializeLibraryQuery(query);
  return serialized ? `/library?${serialized}` : "/library";
}

function EmptyPresentation({ value }: { value: LibraryEmptyStatePresentation }) {
  return (
    <div className="r15-library-empty" data-library-empty={value.kind}>
      <p className="r15-library-empty__index" aria-hidden="true">RETURN / 00</p>
      <div>
        <h2>{value.title}</h2>
        <p>{value.supportingCopy}</p>
        <div className="r15-library-empty__actions">
          {value.actions.map((item) => <Link key={item.href} href={item.href} aria-label={item.accessibleLabel}>{item.label}<span aria-hidden="true">↗</span></Link>)}
        </div>
      </div>
    </div>
  );
}

function ArtistCredits({ card }: { card: LibraryAlbumCardPresentation }) {
  return (
    <p className="r15-library-record__artists">
      {card.artists.map((artist, index) => (
        <span key={`${artist.href}-${index}`}>
          {index ? "、" : ""}<Link href={artist.href}>{artist.name}</Link>
        </span>
      ))}
    </p>
  );
}

function CollectionRecord({ card, index, lead }: { card: LibraryAlbumCardPresentation; index: number; lead: boolean }) {
  return (
    <article className={`r15-library-record${lead ? " r15-library-record--lead" : ""}`} data-library-album={card.albumId}>
      <Link className="r15-library-record__cover" href={card.href} aria-label={card.accessibleLabel}>
        <AlbumCover album={card.album} />
      </Link>
      <div className="r15-library-record__content">
        <p className="r15-library-record__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</p>
        <h3><Link href={card.href}>{card.title}</Link></h3>
        <ArtistCredits card={card} />
        <p className="r15-library-record__meta">{card.releaseYearLabel}<span aria-hidden="true"> / </span>{card.releaseTypeLabel}</p>
        <AlbumActions album={card.album} mode="favorite" />
      </div>
    </article>
  );
}

function RecentRecord({ card, index }: { card: LibraryAlbumCardPresentation; index: number }) {
  return (
    <article className="r15-library-recent-record" data-library-recent={card.albumId}>
      <span className="r15-library-recent-record__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <Link className="r15-library-recent-record__cover" href={card.href} aria-label={card.accessibleLabel}><AlbumCover album={card.album} /></Link>
      <div>
        <h3><Link href={card.href}>{card.title}</Link></h3>
        <ArtistCredits card={card} />
        <p className="r15-library-record__meta">{card.releaseYearLabel}</p>
      </div>
    </article>
  );
}

function LibraryTools({ query, onNavigate }: { query: LibraryQuery; onNavigate: (query: LibraryQuery) => void }) {
  const [value, setValue] = useState(query.query);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onNavigate({ ...query, query: value });
  }

  return (
    <div className="r15-library-tools">
      <form role="search" onSubmit={submit}>
        <label htmlFor="library-query">在当前分类中查找</label>
        <div>
          <input id="library-query" name="q" type="search" maxLength={100} autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} placeholder="专辑、别名或艺人" />
          <button type="submit">查找</button>
          {query.query ? <button type="button" onClick={() => { setValue(""); onNavigate({ ...query, query: "" }); }}>清除</button> : null}
        </div>
      </form>
      <label className="r15-library-sort" htmlFor="library-sort">
        <span>排列</span>
        <select id="library-sort" value={query.sort} onChange={(event) => onNavigate({ ...query, sort: event.target.value as LibraryQuery["sort"] })}>
          <option value="catalog">目录顺序</option>
          <option value="title">标题</option>
          <option value="release-newest">发行时间（新→旧）</option>
        </select>
      </label>
    </div>
  );
}

export function LibraryCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { state, hydrated, storageAvailable } = usePersonalState();
  const model = useMemo(() => {
    const requested = parseLibraryQuery(queryString);
    const publicQuery: LibraryQuery = { ...requested, view: requested.view === "recent" ? "recent" : "favorite" };
    const projection = buildLibraryProjection({ catalog: catalogAlbums, state: hydrated ? state : null, query: publicQuery });
    return buildLibraryPresentationModel({
      projection,
      catalog: catalogAlbums,
      context: storageAvailable ? {} : { recoveryKind: "STORAGE_UNAVAILABLE" },
    });
  }, [hydrated, queryString, state, storageAvailable]);

  function navigate(query: LibraryQuery) {
    router.push(libraryHref(query), { scroll: false });
  }

  if (!hydrated) {
    return (
      <div className="r15-library-loading" role="status" data-library-ready="false">
        <span aria-hidden="true">00</span>
        <p>正在读取当前设备上的专辑清单…</p>
      </div>
    );
  }

  const leadCollection = model.primaryCollection.entries.length >= 4;
  return (
    <div className="r15-library-experience" data-library-ready="true" data-library-view={model.query.view}>
      <nav className="r15-library-facets" aria-label="我的专辑分类">
        {model.facets.map((facet, index) => (
          <Link key={facet.key} href={facet.key === "favorite" ? "/library" : "/library?view=recent"} aria-current={facet.selected ? "page" : undefined} data-facet-group={facet.group}>
            <span>{String(index + 1).padStart(2, "0")}</span><strong>{facet.label}</strong><small>{facet.count}</small>
          </Link>
        ))}
      </nav>

      {model.pageEmptyState ? <EmptyPresentation value={model.pageEmptyState} /> : (
        <>
          <LibraryTools key={`${model.query.view}:${model.query.query}:${model.query.sort}`} query={model.query} onNavigate={navigate} />
          {model.primaryCollection.visible ? (
            <section className="r15-library-collection" aria-labelledby="library-collection-title">
              <header className="r15-library-section-heading">
                <p className="r15-library-section-index" aria-hidden="true">01 / COLLECTION</p>
                <div><h2 id="library-collection-title">{model.primaryCollection.heading}</h2><p>{model.primaryCollection.description}</p></div>
                <p aria-live="polite">{model.primaryCollection.countLabel}</p>
              </header>
              {model.primaryCollection.emptyState ? <EmptyPresentation value={model.primaryCollection.emptyState} /> : (
                <div className="r15-library-grid">
                  {model.primaryCollection.entries.map((card, index) => <CollectionRecord key={card.stableKey} card={card} index={index} lead={leadCollection && index === 0} />)}
                </div>
              )}
            </section>
          ) : null}

          {model.recent.visible ? (
            <section className="r15-library-recent" aria-labelledby="library-recent-title">
              <header className="r15-library-section-heading">
                <p className="r15-library-section-index" aria-hidden="true">02 / RETURN TRAIL</p>
                <div><h2 id="library-recent-title">{model.recent.heading}</h2><p>{model.recent.description}</p></div>
                <p>{model.recent.countLabel}</p>
              </header>
              {model.recent.emptyState ? <EmptyPresentation value={model.recent.emptyState} /> : (
                <div className="r15-library-recent-grid">{model.recent.entries.map((card, index) => <RecentRecord key={card.stableKey} card={card} index={index} />)}</div>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
