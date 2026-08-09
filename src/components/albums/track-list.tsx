import type { PublishedTrack } from "@/catalog/schema";

const duration = (ms: number | null) => ms ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}` : "—";
const sameArtists = (trackArtists: string[], albumArtists: string[]) => trackArtists.length === albumArtists.length && trackArtists.every((artist, index) => artist === albumArtists[index]);

export function TrackList({ tracks, albumArtists = [] }: { tracks: PublishedTrack[]; albumArtists?: string[] }) {
  if (!tracks.length) return <p className="unavailable-note">曲目表暂未收录；不会用其他版本或占位曲目替代。</p>;
  const discs = [...new Set(tracks.map((track) => track.discNumber))];
  return <div className="track-discs">{discs.map((disc) => <section key={disc} aria-labelledby={`disc-${disc}`}><h3 id={`disc-${disc}`}>{discs.length > 1 ? `第 ${disc} 碟` : "曲目"}</h3><ol className="track-list">{tracks.filter((track) => track.discNumber === disc).map((track) => <li key={track.id}><span className="track-list__number">{track.trackNumber}</span><span className="track-list__main"><strong>{track.title}</strong>{track.artists.length && !sameArtists(track.artists, albumArtists) ? <small>{track.artists.join("、")}</small> : null}</span><time>{duration(track.durationMs)}</time></li>)}</ol></section>)}</div>;
}
