import type { PublishedAlbumSummary } from "@/catalog/schema";
import { cn } from "@/lib/utils";
import { AlbumCard } from "./album-card";

export function AlbumGrid({ albums, reasons, actions = "compact", highlight, headingLevel = 2, className }: { albums: PublishedAlbumSummary[]; reasons?: Record<string, string>; actions?: "compact" | "full"; highlight?: string; headingLevel?: 2 | 3; className?: string }) {
  return <div className={cn("album-grid", className)}>{albums.map((album) => <AlbumCard album={album} reason={reasons?.[album.id]} actions={actions} highlight={highlight} headingLevel={headingLevel} key={album.id} />)}</div>;
}
