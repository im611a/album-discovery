import type { CSSProperties } from "react";
import Link from "next/link";
import { AlbumCover } from "@/components/albums/album-cover";
import {
  formatPartialDate,
  RELEASE_TYPE_LABELS,
  type PublishedAlbum,
  type PublishedAlbumSummary,
} from "@/catalog/schema";
import type { PhysicalArchiveSlot } from "@/config/editorial-home";

type CabinetStyle = CSSProperties & {
  "--slot-size": string;
  "--slot-paper": string;
  "--slot-edge": string;
  "--slot-ink": string;
};

export function RecordConsole() {
  return (
    <div className="pa-console" aria-hidden="true">
      <div className="pa-console__base">
        <span className="pa-console__front-edge" />
        <span className="pa-console__hinge pa-console__hinge--left" />
        <span className="pa-console__hinge pa-console__hinge--right" />
      </div>
      <div className="pa-console__platter">
        <span className="pa-console__grooves" />
        <span className="pa-console__label"><small>ALBUM</small><strong>319</strong><i /></span>
      </div>
      <div className="pa-console__bearing"><i /></div>
      <div className="pa-console__tonearm"><span /><i /></div>
      <div className="pa-console__rail pa-console__rail--left" />
      <div className="pa-console__rail pa-console__rail--right" />
    </div>
  );
}

export function RingCabinet({
  albums,
}: {
  albums: { album: PublishedAlbumSummary; slot: PhysicalArchiveSlot }[];
}) {
  return (
    <div className="pa-cabinet" data-ring-cabinet>
      <div className="pa-cabinet__body" aria-hidden="true">
        <span className="pa-cabinet__outer-edge" />
        <span className="pa-cabinet__inner-edge" />
        <span className="pa-cabinet__bridge pa-cabinet__bridge--left" />
        <span className="pa-cabinet__bridge pa-cabinet__bridge--right" />
        <span className="pa-cabinet__drawer-front" />
      </div>
      {albums.map(({ album, slot }) => (
        <article
          className="pa-cabinet-slot"
          data-position={slot.position}
          data-mobile-visible={slot.mobileVisible}
          data-album-cover
          key={slot.slot}
          style={{
            "--slot-size": `${slot.baseSize}px`,
            "--slot-paper": slot.palette.paper,
            "--slot-edge": slot.palette.edge,
            "--slot-ink": slot.palette.ink,
          } as CabinetStyle}
        >
          <span className="pa-cabinet-slot__wall pa-cabinet-slot__wall--left" aria-hidden="true" />
          <span className="pa-cabinet-slot__wall pa-cabinet-slot__wall--right" aria-hidden="true" />
          <Link
            className="pa-cabinet-slot__sleeve"
            href={`/albums/${album.slug}`}
            aria-label={`查看《${album.title}》专辑详情`}
          >
            <span className="pa-cabinet-slot__spine" aria-hidden="true">{slot.slot}</span>
            <AlbumCover album={album} />
            <span className="pa-cabinet-slot__paper-edge" aria-hidden="true" />
          </Link>
          <span className="pa-cabinet-slot__lip" aria-hidden="true" />
          <p><span>{slot.slot}</span><strong>{album.title}</strong></p>
        </article>
      ))}
      <RecordConsole />
    </div>
  );
}

function durationLabel(durationMs: number | null) {
  if (durationMs == null) return "";
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PhysicalAlbumPackage({
  album,
  active = false,
  position,
}: {
  album: PublishedAlbum;
  active?: boolean;
  position: "previous" | "active" | "next";
}) {
  return (
    <article className="pa-package" data-position={position} data-active={active} data-album-cover>
      <div className="pa-package__shadow" aria-hidden="true" />
      <div className="pa-package__vinyl" aria-hidden="true">
        <span className="pa-package__grooves" />
        <span className="pa-package__label"><small>ALBUM DISCOVERY</small><strong>{album.title}</strong><i /></span>
      </div>
      <div className="pa-package__inner" aria-hidden="true">
        <span>{album.trackCount} TRACKS</span>
      </div>
      <div className="pa-package__jacket">
        <span className="pa-package__spine" aria-hidden="true">
          {album.title} · {album.artists.map((artist) => artist.name).join("、")}
        </span>
        <Link className="pa-package__front" href={`/albums/${album.slug}`}>
          <AlbumCover album={album} size="detail" />
          <span className="pa-package__gloss" aria-hidden="true" />
        </Link>
        {active ? (
          <div className="pa-package__back" aria-hidden="true">
            <strong>{album.title}</strong>
            <ol>
              {album.tracks.slice(0, 5).map((track) => (
                <li key={track.id}>
                  <span>{String(track.trackNumber).padStart(2, "0")} {track.title}</span>
                  <time>{durationLabel(track.durationMs)}</time>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
      {active ? (
        <div className="pa-package__sheet" aria-hidden="true">
          <small>ARCHIVE EDITION</small>
          <strong>{album.neteaseAlbumId}</strong>
          <span>
            {formatPartialDate(album.releaseDate, album.releaseDatePrecision)}
            {" · "}
            {RELEASE_TYPE_LABELS[album.albumType]}
          </span>
        </div>
      ) : null}
      <p className="pa-package__side-label">
        <span>{position === "previous" ? "PREVIOUS" : position === "next" ? "NEXT" : "ACTIVE"}</span>
        <strong>{album.title}</strong>
      </p>
    </article>
  );
}

export function ThreeAlbumStage({ albums }: { albums: PublishedAlbum[] }) {
  return (
    <section className="pa-featured" aria-labelledby="featured-sequence-title">
      <header className="pa-section-heading">
        <p>/01–03</p>
        <div>
          <span>重点专辑展台</span>
          <h2 id="featured-sequence-title">三张唱片，三次完整展开。</h2>
          <p>每一幕保留前一张与下一张的实体位置；中央包装使用真实封面、曲目和发行字段。</p>
        </div>
      </header>
      <div className="pa-featured__scenes">
        {albums.map((album, index) => {
          const previous = albums[(index + albums.length - 1) % albums.length];
          const next = albums[(index + 1) % albums.length];
          return (
            <section className="pa-featured-scene" key={album.id} aria-labelledby={`featured-${index + 1}`}>
              <header>
                <span>/{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>完整聆听</small>
                  <h3 id={`featured-${index + 1}`}><Link href={`/albums/${album.slug}`}>{album.title}</Link></h3>
                  <p>{album.artists.map((artist) => artist.name).join("、")} · {album.releaseDate?.slice(0, 4) ?? "日期暂缺"}</p>
                </div>
              </header>
              <div className="pa-featured-scene__stage">
                <PhysicalAlbumPackage album={previous} position="previous" />
                <PhysicalAlbumPackage album={album} active position="active" />
                <PhysicalAlbumPackage album={next} position="next" />
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
