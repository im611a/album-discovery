import { describe, expect, it } from "vitest";
import {
  auditVisibleArtistTopicCatalog,
  simulateVisibleArtistTopicPaths,
} from "./visible-quality-harness";

describe("R13-3D real-catalog visible activation audit", () => {
  it("covers every authorized Artist and Topic with valid deterministic evidence", () => {
    const audit = auditVisibleArtistTopicCatalog();
    expect(audit.artists).toMatchObject({
      evaluated: 300,
      multiWork: 62,
      singleWork: 238,
      validContinuations: 300,
      multiWorkPreservingChronology: 62,
      singleWorkTruthfulEscapes: 238,
      withoutContinuation: 0,
      invalidDestinations: 0,
      unresolvedDestinations: 0,
      duplicateDestinations: 0,
      explanationEvidenceFailures: 0,
      deterministicReplayFailures: 0,
    });
    expect(audit.topics).toMatchObject({
      evaluated: 53,
      validContinuations: 53,
      withoutContinuation: 0,
      invalidTargets: 0,
      unresolvedTargets: 0,
      duplicateDestinations: 0,
      explanationFailures: 0,
      deterministicReplayFailures: 0,
    });
  }, 180_000);

  it("completes 2,000 mixed Album, Artist, and Topic transitions without avoidable loops", () => {
    const report = simulateVisibleArtistTopicPaths({ seedCount: 80, stepsPerSeed: 20 });
    expect(report.summary).toMatchObject({
      requestedTransitions: 2_000,
      completedTransitions: 2_000,
      deadEnds: 0,
      immediateReversals: 0,
      avoidableShortLoops: 0,
      invalidRoutes: 0,
      unresolvedEntities: 0,
      explanationFailures: 0,
      deterministicReplayFailures: 0,
    });
    expect(report.summary.entityTypeCounts.ARTIST).toBeGreaterThan(0);
    expect(Object.entries(report.summary.entityTypeCounts)
      .some(([kind, count]) => kind !== "ARTIST" && count > 0)).toBe(true);
    expect(report.representativePaths.map((path) => path?.initialShape)).toEqual([
      "MULTI_WORK",
      "SINGLE_WORK",
    ]);
  }, 180_000);
});
