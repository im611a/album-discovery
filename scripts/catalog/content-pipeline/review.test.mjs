import { describe, expect, it } from "vitest";
import { applyReviewDecisions, REVIEW_SCHEMA, validateReviewDecisionArtifact } from "./review.mjs";
import { finding, SEVERITY } from "./contracts.mjs";

describe("review decision overlay", () => {
  const context = { batchId: "CONTENT-BATCH-20260821-001", inputSha256: "a".repeat(64), albumIds: ["123"] };

  it("accepts only explicit, bound, reviewable decisions", () => {
    const overlay = validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "123", code: "POSSIBLE_EDITION", decision: "ACCEPT" }] }, context);
    const result = applyReviewDecisions([finding(SEVERITY.NEEDS_REVIEW, "POSSIBLE_EDITION", "Review")], "123", overlay);
    expect(result.findings[0]).toMatchObject({ level: "PASS", code: "HUMAN_REVIEW_ACCEPTED", reviewedFindingCode: "POSSIBLE_EDITION" });
  });

  it("refuses errors and foreign or invented review codes", () => {
    expect(() => validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "999", code: "POSSIBLE_EDITION", decision: "ACCEPT" }] }, context)).toThrow(/FOREIGN_REVIEW_ALBUM/u);
    expect(() => validateReviewDecisionArtifact({ schema: REVIEW_SCHEMA, batchId: context.batchId, inputSha256: context.inputSha256, decisions: [{ albumId: "123", code: "CANDIDATE_CATALOG_INVALID", decision: "ACCEPT" }] }, context)).toThrow(/REVIEW_CODE_NOT_ALLOWED/u);
  });
});
