import { describe, expect, it } from "vitest";

import { createInitialUserState } from "@/features/personal-state/schema";

import { buildArtistCollectionAlbumHref, inspectArtistCollectionNavigationAuthority } from "./artist-collection-navigation";
import { auditArtistAlbumGraph, projectAllArtistCollections, projectArtistCollection } from "./artist-collection";
import { buildCrossProductEntityHref, MAX_CROSS_PRODUCT_CONTEXT_URL_LENGTH } from "./contextual-navigation";
import { parseNavigationOrigin } from "./navigation-origin";
import { catalogAlbums, publishedArtists } from "./published-catalog";

function generator(initial: number) {
  let seed = initial >>> 0;
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function queryValues(value: string, token: string) {
  return new URLSearchParams(value.split("?")[1] ?? value).getAll(token);
}

describe("R16-2E cross-product navigation stress", () => {
  it("replays 50,000 mixed transitions over two fixed seed sets without authority drift or URL growth", () => {
    const failures = {
      invalidTarget: 0,
      unresolvedTarget: 0,
      duplicateProvenanceToken: 0,
      provenanceMismatch: 0,
      falseReturnDestination: 0,
      nondeterministicNormalizedUrl: 0,
      avoidableImmediateLoop: 0,
      avoidableShortLoop: 0,
      urlGrowthViolation: 0,
    };
    let transitions = 0;
    for (const seed of [0x1602, 0x16e5]) {
      const random = generator(seed);
      let context = "";
      for (let step = 0; step < 25_000; step += 1) {
        const album = catalogAlbums[Math.floor(random() * catalogAlbums.length)]!;
        const artist = publishedArtists.find((candidate) => candidate.albumIds.includes(album.id))!;
        const originKind = step % 7;
        const incoming = originKind === 0
          ? "lfrom=library&lview=favorite&lq=ambient&lsort=title"
          : originKind === 1
            ? "sfrom=search&sq=Bj%C3%B6rk&spage=3"
            : originKind === 2
              ? `entry=explore&trail=${album.slug}&via=SHARED_ARTIST`
              : originKind === 3
                ? `pfrom=for-you&ptrail=${album.slug}`
                : originKind === 4
                  ? `lfrom=library&sfrom=search&pfrom=unknown&trail=${"x".repeat(600)}`
                  : originKind === 5
                    ? context
                    : "";
        const artistPath = `/artists/${artist.slug}`;
        const first = buildCrossProductEntityHref({ pathname: artistPath, currentAlbumSlug: album.slug, searchParams: incoming, catalog: catalogAlbums });
        const replay = buildCrossProductEntityHref({ pathname: artistPath, currentAlbumSlug: album.slug, searchParams: incoming, catalog: catalogAlbums });
        const query = first.split("?")[1] ?? "";
        const nextAlbum = artist.albumIds[Math.floor(random() * artist.albumIds.length)]!;
        const target = catalogAlbums.find((candidate) => candidate.id === nextAlbum);
        const albumPath = target ? buildArtistCollectionAlbumHref({ targetSlug: target.slug, searchParams: query, catalog: catalogAlbums }) : null;
        transitions += 1;
        if (!first.startsWith(artistPath) || first.startsWith("//")) failures.invalidTarget += 1;
        if (!artist || !target || !albumPath) failures.unresolvedTarget += 1;
        for (const token of ["entry", "entryKey", "trail", "via", "pfrom", "ptrail", "lfrom", "sfrom", "lview", "sq"]) {
          if (queryValues(first, token).length > 1 || (albumPath && queryValues(albumPath, token).length > 1)) failures.duplicateProvenanceToken += 1;
        }
        const authority = inspectArtistCollectionNavigationAuthority(query, catalogAlbums);
        const returnOrigin = parseNavigationOrigin(query).kind;
        if (authority.returnOrigin !== returnOrigin) failures.provenanceMismatch += 1;
        if (incoming.includes("lfrom=library&sfrom=search") && returnOrigin !== "NONE") failures.falseReturnDestination += 1;
        if (first !== replay) failures.nondeterministicNormalizedUrl += 1;
        if (first.length > MAX_CROSS_PRODUCT_CONTEXT_URL_LENGTH || (albumPath?.length ?? 0) > MAX_CROSS_PRODUCT_CONTEXT_URL_LENGTH) failures.urlGrowthViolation += 1;
        if (albumPath === first) failures.avoidableImmediateLoop += 1;
        for (const key of ["trail", "ptrail"] as const) {
          const tokens = queryValues(albumPath ?? "", key).flatMap((value) => value.split("~")).filter(Boolean);
          if (new Set(tokens).size !== tokens.length) failures.avoidableShortLoop += 1;
        }
        context = albumPath?.split("?")[1] ?? "";
      }
    }
    console.info("R16_2E_NAVIGATION_STRESS", JSON.stringify({ transitions, seedSets: 2, ...failures }));
    expect(transitions).toBe(50_000);
    expect(failures).toEqual({
      invalidTarget: 0,
      unresolvedTarget: 0,
      duplicateProvenanceToken: 0,
      provenanceMismatch: 0,
      falseReturnDestination: 0,
      nondeterministicNormalizedUrl: 0,
      avoidableImmediateLoop: 0,
      avoidableShortLoop: 0,
      urlGrowthViolation: 0,
    });
  }, 600_000);
});

describe("R16-2F canonical Album and local-state stress", () => {
  it("audits the entire real Artist/Album graph and every shared-credit identity", () => {
    expect(auditArtistAlbumGraph(publishedArtists, catalogAlbums)).toEqual({
      artistCount: 453,
      albumCount: 1_330,
      singleWorkArtists: 297,
      multiWorkArtists: 156,
      artistAlbumMemberships: 1_794,
      invalidArtistReferences: 0,
      invalidAlbumReferences: 0,
      unresolvedAlbumReferences: 0,
      duplicateArtistNodes: 0,
      duplicateAlbumNodes: 0,
      duplicateArtistAlbumMemberships: 0,
      creditMismatches: 0,
    });
    const shared = catalogAlbums.filter((album) => album.artists.length > 1);
    for (const album of shared) {
      const state = { ...createInitialUserState(), favoriteAlbumIds: [album.id], recentAlbumIds: [album.id] };
      const signatures = album.artists.map((credit) => {
        const artist = publishedArtists.find((candidate) => candidate.artistId === credit.id)!;
        const entry = projectArtistCollection({ artist, catalog: catalogAlbums, state }).publishedAlbums.find((candidate) => candidate.albumId === album.id)!;
        return JSON.stringify([entry.albumId, entry.slug, entry.primaryStatus, entry.kept, entry.states, entry.recentPosition]);
      });
      expect(new Set(signatures)).toHaveLength(1);
    }
  });

  it("projects 100,000 deterministic states and replays over all Artists with explicit zero-valued failure counters", () => {
    const ids = catalogAlbums.map((album) => album.id);
    const validIds = new Set(ids);
    const failures = {
      invalidTarget: 0,
      unresolvedTarget: 0,
      duplicateTarget: 0,
      falseSemanticClaim: 0,
      falsePersonalClaim: 0,
      falseListeningClaim: 0,
      falseArtistAffinityClaim: 0,
      provenanceMismatch: 0,
      chronologyMutation: 0,
      nondeterministicOutput: 0,
      unexpectedEmptyProjection: 0,
      stateDivergence: 0,
    };
    const random = generator(0x162f);
    const sample = (length: number) => Array.from({ length }, () => ids[Math.floor(random() * ids.length)]!);
    let projections = 0;
    for (let scenario = 0; scenario < 100_000; scenario += 1) {
      const dismissed = sample(scenario % 9);
      const state = {
        ...createInitialUserState(),
        savedAlbumIds: sample(scenario % 17),
        likedAlbumIds: sample(scenario % 13),
        favoriteAlbumIds: sample(scenario % 11),
        listenedAlbumIds: sample(scenario % 7),
        dismissedAlbumIds: dismissed,
        recentAlbumIds: sample(20),
        recommendationFeedback: Object.fromEntries(dismissed.map((id) => [id, "not_for_me"] as const)),
      };
      const first = projectAllArtistCollections({ artists: publishedArtists, catalog: catalogAlbums, state });
      const replay = projectAllArtistCollections({ artists: publishedArtists, catalog: catalogAlbums, state });
      projections += first.length;
      for (let index = 0; index < first.length; index += 1) {
        const value = first[index]!;
        const again = replay[index]!;
        const entries = value.publishedAlbums;
        failures.invalidTarget += entries.filter((entry) => !validIds.has(entry.albumId)).length;
        failures.unresolvedTarget += entries.filter((entry) => !entry.album.artists.some((credit) => credit.id === value.artist.artistId)).length;
        if (new Set(entries.map((entry) => entry.albumId)).size !== entries.length) failures.duplicateTarget += 1;
        if (entries.some((entry) => entry.kept && entry.states.dismissed)) failures.falseSemanticClaim += 1;
        if (JSON.stringify(value).match(/follow|fandom|affinity|preference/i)) failures.falseArtistAffinityClaim += 1;
        if (entries.some((entry) => entry.primaryStatus === "RECENTLY_VIEWED" && entry.states.markedListened)) failures.falseListeningClaim += 1;
        if (entries.some((entry, position) => entry.chronologyPosition !== position)) failures.chronologyMutation += 1;
        if (!entries.length) failures.unexpectedEmptyProjection += 1;
        const signature = (projection: typeof value) => JSON.stringify([projection.artist, projection.publishedAlbums.map((entry) => [entry.albumId, entry.primaryStatus, entry.kept, entry.recentPosition]), projection.summary]);
        if (signature(value) !== signature(again)) failures.nondeterministicOutput += 1;
        if (value.summary.keptWorksCount !== value.keptAlbums.length || value.summary.dismissedWorksCount !== value.dismissedAlbums.length || value.summary.recentlyViewedWorksCount !== value.recentlyViewedAlbums.length) failures.stateDivergence += 1;
      }
    }
    console.info("R16_2F_STATE_STRESS", JSON.stringify({ generatedStates: 100_000, deterministicReplays: 100_000, artists: publishedArtists.length, projections, ...failures }));
    expect(projections).toBe(100_000 * publishedArtists.length);
    expect(failures).toEqual({
      invalidTarget: 0,
      unresolvedTarget: 0,
      duplicateTarget: 0,
      falseSemanticClaim: 0,
      falsePersonalClaim: 0,
      falseListeningClaim: 0,
      falseArtistAffinityClaim: 0,
      provenanceMismatch: 0,
      chronologyMutation: 0,
      nondeterministicOutput: 0,
      unexpectedEmptyProjection: 0,
      stateDivergence: 0,
    });
  }, 4_200_000);

  it("reconciles 100,000 canonical mutation transitions without retaining stale Artist state", () => {
    const random = generator(0x16f6);
    const states = ["savedAlbumIds", "favoriteAlbumIds", "listenedAlbumIds", "dismissedAlbumIds"] as const;
    let transitions = 0;
    const failures = { staleProjection: 0, sharedStateDivergence: 0, chronologyMutation: 0 };
    for (let sequence = 0; sequence < 20_000; sequence += 1) {
      const album = catalogAlbums[Math.floor(random() * catalogAlbums.length)]!;
      const creditedArtists = album.artists.map((credit) => publishedArtists.find((artist) => artist.artistId === credit.id)!).filter(Boolean);
      let state = createInitialUserState();
      for (let step = 0; step < 5; step += 1) {
        const key = states[step % states.length]!;
        state = { ...createInitialUserState(), [key]: step === 4 ? [] : [album.id], recentAlbumIds: step % 2 ? [album.id] : [] };
        const projected = creditedArtists.map((artist) => projectArtistCollection({ artist, catalog: catalogAlbums, state }));
        const entries = projected.map((value) => value.publishedAlbums.find((entry) => entry.albumId === album.id)!);
        const signatures = entries.map((entry) => JSON.stringify([entry.primaryStatus, entry.kept, entry.states, entry.recentPosition]));
        if (new Set(signatures).size !== 1) failures.sharedStateDivergence += 1;
        if (step === 4 && entries.some((entry) => entry.kept || entry.primaryStatus !== "NONE")) failures.staleProjection += 1;
        if (projected.some((value) => value.publishedAlbums.some((entry, position) => entry.chronologyPosition !== position))) failures.chronologyMutation += 1;
        transitions += 1;
      }
    }
    console.info("R16_2F_MUTATION_STRESS", JSON.stringify({ transitions, ...failures }));
    expect(transitions).toBe(100_000);
    expect(failures).toEqual({ staleProjection: 0, sharedStateDivergence: 0, chronologyMutation: 0 });
  }, 600_000);
});
