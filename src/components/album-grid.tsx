import type { PublishedAlbum } from "@/catalog/schema";
import { AlbumCard } from "./album-card";

export function AlbumGrid({ albums, reasons }: { albums: PublishedAlbum[]; reasons?: Record<string, string> }) {
  return <div className="album-grid">{albums.map((album) => <AlbumCard album={album} reason={reasons?.[album.id]} key={album.id} />)}</div>;
}
