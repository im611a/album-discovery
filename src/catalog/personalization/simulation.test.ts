import { describe, expect, it } from "vitest";
import { catalogAlbums } from "../published-catalog";
import { runR14PersonalizationSimulation } from "./simulation-harness";

describe("R14 large deterministic personalization simulation", () => {
  it("completes 20,000 decisions and 10,000 transitions without contract failures", () => {
    const representativeCatalog = catalogAlbums.filter((_, index) => index % 3 === 0).slice(0, 120);
    const report = runR14PersonalizationSimulation(representativeCatalog, 2_000, 1_000);
    expect(report).toEqual({
      fixtureClasses: 10,
      decisions: 20_000,
      transitions: 10_000,
      invalidTargets: 0,
      unresolvedTargets: 0,
      duplicateCandidates: 0,
      avoidableShortLoops: 0,
      sameArtistSaturation: 0,
      sameGenreSaturation: 0,
      sameEraSaturation: 0,
      falsePersonalization: 0,
      relationMislabeledPersonal: 0,
      randomMislabeledPersonal: 0,
      explanationMismatch: 0,
      determinismFailure: 0,
    });
  }, 120_000);
});
