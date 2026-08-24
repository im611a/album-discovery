import { describe, expect, it } from "vitest";
import {
  auditVisibleArtistTopicCatalog,
  simulateVisibleArtistTopicPaths,
} from "./visible-quality-harness";

describe("R13-3D real-catalog visible activation audit", () => {
  it("covers every authorized Artist and Topic with valid deterministic evidence", () => {
    const audit = auditVisibleArtistTopicCatalog();
    expect(audit.artists).toMatchObject({
      evaluated: 453,
      multiWork: 156,
      singleWork: 297,
      validContinuations: 453,
      multiWorkPreservingChronology: 156,
      singleWorkTruthfulEscapes: 297,
      withoutContinuation: 0,
      invalidDestinations: 0,
      unresolvedDestinations: 0,
      duplicateDestinations: 0,
      explanationEvidenceFailures: 0,
      deterministicReplayFailures: 0,
    });
    expect(audit.topics).toMatchObject({
      evaluated: 55,
      validContinuations: 55,
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
      immediateReversals: 10,
      truthfulExhaustionReversals: 10,
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
  }, 900_000);
});
