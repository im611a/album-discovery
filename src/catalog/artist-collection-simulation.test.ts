import { describe, expect, it } from "vitest";

import { projectAllArtistCollections } from "./artist-collection";
import { catalogAlbums, publishedArtists } from "./published-catalog";

describe("R16 deterministic all-Artist collection simulation", () => {
  it("runs 20,000 local-state scenarios across every Artist with zero projection failures", () => {
    let seed = 1601;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const ids = catalogAlbums.map((album) => album.id);
    const sample = (length: number, stale = false) => Array.from({ length }, (_, index) => stale && index % 17 === 0 ? `stale:${index}` : ids[Math.floor(random() * ids.length)]!);
    const validAlbums = new Set(ids);
    const failures = {
      exceptions: 0,
      invalidTargets: 0,
      unresolvedTargets: 0,
      duplicateProjectedAlbums: 0,
      stateCountMismatches: 0,
      falseSemanticClaims: 0,
      nondeterministicOutputs: 0,
      chronologyMismatches: 0,
    };
    let projections = 0;
    for (let scenario = 0; scenario < 20_000; scenario += 1) {
      const dismissed = sample(scenario % 11, true);
      const state: unknown = scenario % 19 === 0
        ? { savedAlbumIds: "malformed", recentAlbumIds: [null, ...sample(28, true)], futureState: true }
        : {
          version: 1,
          savedAlbumIds: [...sample(scenario % 31, true), ...sample(3)],
          likedAlbumIds: sample(scenario % 29, true),
          favoriteAlbumIds: sample(scenario % 23, true),
          listenedAlbumIds: [...sample(scenario % 19, true), ...dismissed.slice(0, 2)],
          dismissedAlbumIds: dismissed,
          recentAlbumIds: sample(35, true),
          recommendationFeedback: Object.fromEntries(dismissed.map((id) => [id, "not_for_me"])),
        };
      try {
        const first = projectAllArtistCollections({ artists: publishedArtists, catalog: catalogAlbums, state });
        const replay = projectAllArtistCollections({ artists: publishedArtists, catalog: catalogAlbums, state });
        projections += first.length;
        for (let index = 0; index < first.length; index += 1) {
          const projection = first[index]!;
          const again = replay[index]!;
          const projectedIds = projection.publishedAlbums.map((entry) => entry.albumId);
          failures.invalidTargets += projectedIds.filter((id) => !validAlbums.has(id)).length;
          failures.unresolvedTargets += projection.publishedAlbums.filter((entry) => !entry.album.artists.some((credit) => credit.id === projection.artist.artistId)).length;
          if (new Set(projectedIds).size !== projectedIds.length) failures.duplicateProjectedAlbums += 1;
          if (projection.summary.keptWorksCount !== projection.keptAlbums.length
            || projection.summary.listenLaterWorksCount !== projection.listenLaterAlbums.length
            || projection.summary.likedWorksCount !== projection.likedAlbums.length
            || projection.summary.favoriteWorksCount !== projection.favoriteAlbums.length
            || projection.summary.markedListenedWorksCount !== projection.markedListenedAlbums.length
            || projection.summary.dismissedWorksCount !== projection.dismissedAlbums.length
            || projection.summary.recentlyViewedWorksCount !== projection.recentlyViewedAlbums.length
            || projection.summary.uncollectedPublishedWorksCount !== projection.uncollectedPublishedAlbums.length) failures.stateCountMismatches += 1;
          if (projection.keptAlbums.some((entry) => entry.states.dismissed)
            || projection.recentlyViewedAlbums.some((entry) => entry.kept && entry.membershipReasons.length === 0)) failures.falseSemanticClaims += 1;
          const signature = (value: typeof projection) => JSON.stringify([
            value.artist.artistId,
            value.publishedAlbums.map((entry) => [entry.albumId, entry.primaryStatus, entry.kept, entry.recentPosition]),
            value.summary,
          ]);
          if (signature(projection) !== signature(again)) failures.nondeterministicOutputs += 1;
          if (projection.publishedAlbums.some((entry, position) => entry.chronologyPosition !== position)) failures.chronologyMismatches += 1;
        }
      } catch {
        failures.exceptions += 1;
      }
    }
    console.info("R16_ARTIST_COLLECTION_SIMULATION", JSON.stringify({ scenarios: 20_000, artists: publishedArtists.length, projections, ...failures }));
    expect(projections).toBe(20_000 * publishedArtists.length);
    expect(failures).toEqual({
      exceptions: 0,
      invalidTargets: 0,
      unresolvedTargets: 0,
      duplicateProjectedAlbums: 0,
      stateCountMismatches: 0,
      falseSemanticClaims: 0,
      nondeterministicOutputs: 0,
      chronologyMismatches: 0,
    });
  }, 300_000);
});
