import { describe, expect, it } from "vitest";
import { applyReviewDecisions, reviewTemplate, REVIEW_SCHEMA, validateReviewDecisionArtifact } from "./review.mjs";
import { finding, SEVERITY } from "./contracts.mjs";

describe("review decision overlay", () => {
  const context = { batchId: "CONTENT-BATCH-20260821-001", inputSha256: "a".repeat(64), albumIds: ["123"] };

  it("accepts only explicit, bound, reviewable decisions", () => {
    const overlay = validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "123", code: "POSSIBLE_EDITION", decision: "ACCEPT" }] }, context);
    const result = applyReviewDecisions([finding(SEVERITY.NEEDS_REVIEW, "POSSIBLE_EDITION", "Review")], "123", overlay);
    expect(result.findings[0]).toMatchObject({ level: "PASS", code: "HUMAN_REVIEW_ACCEPTED", reviewedFindingCode: "POSSIBLE_EDITION" });
  });

  it("keeps PENDING blocking and preserves rejected evidence", () => {
    expect(() => validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "123", code: "POSSIBLE_EDITION", decision: "PENDING" }] }, context)).toThrow(/REVIEW_DECISION_PENDING/u);
    const overlay = validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "123", code: "POSSIBLE_EDITION", decision: "REJECT" }] }, context);
    const original = finding(SEVERITY.NEEDS_REVIEW, "POSSIBLE_EDITION", "Original review evidence", "Review it.", { conflict: { id: "1" } });
    const result = applyReviewDecisions([original], "123", overlay);
    expect(result.rejected).toBe(true);
    expect(result.findings[0]).toMatchObject({ level: "PASS", code: "HUMAN_REVIEW_REJECTED", reviewedFindingCode: "POSSIBLE_EDITION", reviewedDecision: "REJECT", originalFinding: original });
  });

  it("quarantines only the explicit deterministic invalid_track_list error", () => {
    const overlay = validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [], quarantines: [{ albumId: "123", code: "invalid_track_list", decision: "QUARANTINE" }] }, context);
    const original = finding(SEVERITY.ERROR, "invalid_track_list", "No complete multi-track list.", "Keep source evidence.");
    const result = applyReviewDecisions([original], "123", overlay);
    expect(result.quarantined).toBe(true);
    expect(result.findings[0]).toMatchObject({ level: "PASS", code: "QUARANTINED_INVALID_SOURCE_DATA", quarantinedFindingCode: "invalid_track_list", originalFinding: original });
    expect(() => validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [], quarantines: [{ albumId: "123", code: "UNKNOWN_ERROR", decision: "QUARANTINE" }] }, context)).toThrow(/QUARANTINE_CODE_NOT_ALLOWED/u);
  });

  it("exports identity conflicts and deterministic quarantine separately", () => {
    const template = reviewTemplate({ batchId: context.batchId, inputSha256: context.inputSha256, records: [{ albumId: "123", findings: [finding(SEVERITY.NEEDS_REVIEW, "CANDIDATE_IDENTITY_CONFLICT", "Conflict"), finding(SEVERITY.ERROR, "invalid_track_list", "Tracks")] }] });
    expect(template.decisions).toEqual([{ albumId: "123", code: "CANDIDATE_IDENTITY_CONFLICT", decision: "PENDING" }]);
    expect(template.quarantines).toEqual([{ albumId: "123", code: "invalid_track_list", decision: "PENDING" }]);
  });

  it("refuses errors and foreign or invented review codes", () => {
    expect(() => validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "999", code: "POSSIBLE_EDITION", decision: "ACCEPT" }] }, context)).toThrow(/FOREIGN_REVIEW_ALBUM/u);
    expect(() => validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "123", code: "CANDIDATE_CATALOG_INVALID", decision: "ACCEPT" }] }, context)).toThrow(/REVIEW_CODE_NOT_ALLOWED/u);
    expect(() => validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "123", code: "invalid_track_list", decision: "REJECT" }] }, context)).toThrow(/REVIEW_CODE_NOT_ALLOWED/u);
  });
});
