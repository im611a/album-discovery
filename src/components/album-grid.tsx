import type { PublishedAlbum } from "@/catalog/schema";
import { AlbumCard } from "./album-card";

export function AlbumGrid({ albums, reasons, actions = "compact", highlight, headingLevel = 2 }: { albums: PublishedAlbum[]; reasons?: Record<string, string>; actions?: "compact" | "full"; highlight?: string; headingLevel?: 2 | 3 }) {
  return <div className="album-grid">{albums.map((album) => <AlbumCard album={album} reason={reasons?.[album.id]} actions={actions} highlight={highlight} headingLevel={headingLevel} key={album.id} />)}</div>;
}
