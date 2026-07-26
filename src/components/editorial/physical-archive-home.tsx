import type { CSSProperties } from "react";
import Link from "next/link";
import { AlbumCover } from "@/components/albums/album-cover";
import type { PublishedAlbum, PublishedAlbumSummary } from "@/catalog/schema";
import type { PhysicalArchiveSlot } from "@/config/editorial-home";
import { RecordPackage } from "./record-package";

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

export function QuietArchiveOpening() {
  return (
    <div className="pa-quiet-device" data-home-state="quiet">
      <div className="pa-quiet-device__field" aria-hidden="true">
        <span className="pa-quiet-device__wall pa-quiet-device__wall--left" />
        <span className="pa-quiet-device__wall pa-quiet-device__wall--right" />
        <span className="pa-quiet-device__horizon" />
      </div>
      <RecordConsole />
    </div>
  );
}

export function ArchiveAwakeningStructure({
  albums,
}: {
  albums: { album: PublishedAlbumSummary; slot: PhysicalArchiveSlot }[];
}) {
  return (
    <section className="pa-archive-axis" data-home-state="awakening" aria-labelledby="archive-awakening-title">
      <header className="pa-archive-axis__heading">
        <span>实体收藏轴线</span>
        <h2 id="archive-awakening-title">从空置装置，到一柜可以翻阅的唱片。</h2>
        <p>沿着同一座柜体向下，导轨、槽位与唱片依次进入视野。</p>
      </header>
      <div className="pa-archive-axis__device" data-motion-gallery>
        <div className="pa-awakening__structure" aria-hidden="true">
        <span className="pa-awakening__wall pa-awakening__wall--left" />
        <span className="pa-awakening__wall pa-awakening__wall--right" />
        <span className="pa-awakening__rail pa-awakening__rail--top" />
        <span className="pa-awakening__rail pa-awakening__rail--bottom" />
        <span className="pa-awakening__opening" />
        <span className="pa-awakening__drawer" />
        </div>
        <RingCabinet albums={albums} />
      </div>
    </section>
  );
}

export function RingCabinet({
  albums,
}: {
  albums: { album: PublishedAlbumSummary; slot: PhysicalArchiveSlot }[];
}) {
  return (
    <div className="pa-cabinet" data-ring-cabinet data-home-state="cabinet">
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
          data-motion-gallery-item
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
            <span className="pa-cabinet-slot__spine" aria-hidden="true">{album.title}</span>
            <AlbumCover album={album} />
            <span className="pa-cabinet-slot__paper-edge" aria-hidden="true" />
          </Link>
          <span className="pa-cabinet-slot__lip" aria-hidden="true" />
          <p><strong>{album.title}</strong></p>
        </article>
      ))}
      <RecordConsole />
    </div>
  );
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
    <article
      className="pa-package"
      data-position={position}
      data-featured-album
      data-featured-role={position}
      data-active={active}
      data-album-cover
      data-motion-deck-item
    >
      <RecordPackage album={album} expanded={active} />
      <p className="pa-package__side-label">
        <strong>{album.title}</strong>
        <span>{album.artists.map((artist) => artist.name).join("、")}</span>
      </p>
    </article>
  );
}

export function ThreeAlbumStage({ albums }: { albums: PublishedAlbum[] }) {
  if (albums.length < 3) return null;
  const [previous, active, next] = albums;

  return (
    <section className="pa-featured" aria-labelledby="featured-sequence-title">
      <header className="pa-section-heading">
        <p>三张唱片</p>
        <div>
          <span>重点专辑展台</span>
          <h2 id="featured-sequence-title">一座展台，同时保留前后关系。</h2>
          <p>中央唱片打开为完整包装；前一张与后一张始终留在同一条收藏轴线上。</p>
        </div>
      </header>
      <div className="pa-featured-scene" data-motion-deck>
        <div className="pa-featured-scene__stage">
          <PhysicalAlbumPackage album={previous} position="previous" />
          <PhysicalAlbumPackage album={active} active position="active" />
          <PhysicalAlbumPackage album={next} position="next" />
        </div>
      </div>
    </section>
  );
}
