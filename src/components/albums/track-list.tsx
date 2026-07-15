import type { MockTrack } from "@/data/album-details.mock";
import {
  formatDuration,
  groupTracksByDisc,
  shouldShowTrackArtists,
} from "@/lib/album-details";
import { formatArtists } from "@/lib/albums";

type TrackListProps = {
  albumArtists: string[];
  tracks: MockTrack[];
};

export function TrackList({ albumArtists, tracks }: TrackListProps) {
  const discs = groupTracksByDisc(tracks);
  const hasMultipleDiscs = discs.length > 1;

  return (
    <div className="track-list">
      {discs.map((disc) => (
        <section
          aria-labelledby={hasMultipleDiscs ? `disc-${disc.discNumber}` : undefined}
          className="track-disc"
          key={disc.discNumber}
        >
          {hasMultipleDiscs ? (
            <h3 id={`disc-${disc.discNumber}`}>Disc {disc.discNumber}</h3>
          ) : null}
          <ol aria-label={hasMultipleDiscs ? `Disc ${disc.discNumber} 曲目` : "曲目"}>
            {disc.tracks.map((track) => (
              <li key={track.id}>
                <span className="track-list__number" aria-label={`第 ${track.trackNumber} 首`}>
                  {track.trackNumber.toString().padStart(2, "0")}
                </span>
                <div className="track-list__identity">
                  <strong>{track.title}</strong>
                  {shouldShowTrackArtists(track.artists, albumArtists) ? (
                    <span>{formatArtists(track.artists)}</span>
                  ) : null}
                </div>
                <time
                  className="track-list__duration"
                  dateTime={`PT${Math.floor(track.durationMs / 1000)}S`}
                >
                  {formatDuration(track.durationMs)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
