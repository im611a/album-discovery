import { describe, expect, expectTypeOf, it } from "vitest";

import {
  validateImportRun,
  validateManualOverride,
  validateMatchDecision,
  validateNewReleaseDiscovery,
  validateRunEntryFailure,
  validateRymRatingSnapshot,
  validateSourceFetchSnapshot,
  validateSourceRecord,
  validateSyncRun,
  type ImportRun,
  type ManualOverride,
  type MatchDecision,
  type RymRatingSnapshot,
  type SourceRecord,
  type SyncRun,
} from "@/domain/observations";
import {
  parseAlbumId,
  parseExternalIdentifierId,
  parseImportRunId,
  parseManualOverrideId,
  parseMatchDecisionId,
  parseSourceRecordId,
  parseSyncRunId,
  parseTaxonomyTermId,
} from "@/domain/ids";
import { parseUtcIsoTimestamp, type UtcIsoTimestamp } from "@/domain/sources";

function valueOf<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error("Expected a valid test ID.");
  return result.value;
}

function utc(value: string): UtcIsoTimestamp {
  const result = parseUtcIsoTimestamp(value);
  if (!result.ok) throw new Error("Expected a valid UTC test timestamp.");
  return result.value;
}

const syncRunId = valueOf(parseSyncRunId("sync-run-a1"));
const importRunId = valueOf(parseImportRunId("import-run-a1"));
const albumId = valueOf(parseAlbumId("album-internal-a1"));
const sourceRecordId = valueOf(parseSourceRecordId("source-record-a1"));
const externalIdentifierId = valueOf(parseExternalIdentifierId("external-link-a1"));

describe("SourceRecord type boundary", () => {
  it("keeps ExternalIdentifier as the only source identity authority", () => {
    expectTypeOf<SourceRecord>().toHaveProperty("externalIdentifierId");
    expectTypeOf<SourceRecord>().not.toHaveProperty("canonicalEntityId");
    expectTypeOf<SourceRecord>().not.toHaveProperty("externalId");
    expectTypeOf<SourceRecord>().not.toHaveProperty("entityType");
  });
});

const syncRun: SyncRun = {
  id: syncRunId,
  source: "NETEASE",
  operation: "catalog-metadata",
  requestedScope: "synthetic-scope",
  startedAt: utc("2026-07-17T00:00:00.000Z"),
  completedAt: utc("2026-07-17T00:01:00.000Z"),
  status: "SUCCEEDED",
  sourceVersion: null,
  parserVersion: "0.3A.1",
  normalizerVersion: "not-implemented",
  requestCount: 2,
  successCount: 2,
  failureCount: 0,
  errorSummary: null,
};

const importRun: ImportRun = {
  id: importRunId,
  source: "RYM",
  operation: "DRY_RUN",
  requestedScope: "synthetic-local-file",
  sourceDescription: "Synthetic offline fixture supplied for contract testing",
  fileName: "synthetic-input.csv",
  fileChecksum: "synthetic-checksum",
  startedAt: utc("2026-07-17T00:00:00.000Z"),
  completedAt: utc("2026-07-17T00:01:00.000Z"),
  importedAt: utc("2026-07-17T00:00:00.000Z"),
  sourceVersion: null,
  normalizerVersion: "0.3A.1",
  status: "DRY_RUN",
  rowCount: 1,
  successCount: 1,
  failureCount: 0,
  errorSummary: null,
};

describe("run contracts", () => {
  it("accepts coherent sync and offline import run records", () => {
    expect(validateSyncRun(syncRun)).toEqual([]);
    expect(validateImportRun(importRun)).toEqual([]);
  });

  it("rejects run counters that exceed the requested scope count", () => {
    expect(
      validateSyncRun({ ...syncRun, requestCount: 1, successCount: 1, failureCount: 1 }).map(
        (item) => item.code,
      ),
    ).toContain("COUNT_EXCEEDS_REQUESTS");
    expect(
      validateImportRun({ ...importRun, rowCount: 1, successCount: 1, failureCount: 1 }).map(
        (item) => item.code,
      ),
    ).toContain("COUNT_EXCEEDS_ROWS");
  });

  it("keeps the approved run records limited to non-sensitive operational fields", () => {
    expect(Object.keys(syncRun).sort()).toEqual(
      [
        "completedAt",
        "errorSummary",
        "failureCount",
        "id",
        "normalizerVersion",
        "operation",
        "parserVersion",
        "requestCount",
        "requestedScope",
        "source",
        "sourceVersion",
        "startedAt",
        "status",
        "successCount",
      ].sort(),
    );
  });

  it("enforces successful, failed, partial, and running sync count invariants", () => {
    expect(
      validateSyncRun({ ...syncRun, successCount: 1, failureCount: 1 }).map((item) => item.code),
    ).toContain("SUCCEEDED_WITH_FAILURES");
    expect(
      validateSyncRun({ ...syncRun, status: "FAILED", successCount: 1, failureCount: 1 }).map(
        (item) => item.code,
      ),
    ).toContain("FAILED_WITH_SUCCESSES");
    expect(
      validateSyncRun({ ...syncRun, status: "FAILED", successCount: 0, failureCount: 0 }).map(
        (item) => item.code,
      ),
    ).toEqual(expect.arrayContaining(["FAILED_WITHOUT_FAILURES", "TERMINAL_COUNT_MISMATCH"]));
    expect(
      validateSyncRun({ ...syncRun, status: "PARTIAL", successCount: 2, failureCount: 0 }).map(
        (item) => item.code,
      ),
    ).toContain("PARTIAL_WITHOUT_MIXED_RESULTS");
    expect(
      validateSyncRun({ ...syncRun, status: "PARTIAL", successCount: 1, failureCount: 1 }),
    ).toEqual([]);
    expect(
      validateSyncRun({
        ...syncRun,
        status: "RUNNING",
        completedAt: null,
        successCount: 1,
        failureCount: 0,
      }),
    ).toEqual([]);
  });

  it("rejects incomplete terminal counts, invalid counts, and incoherent completion times", () => {
    expect(
      validateSyncRun({ ...syncRun, successCount: 1 }).map((item) => item.code),
    ).toContain("TERMINAL_COUNT_MISMATCH");
    expect(
      validateSyncRun({ ...syncRun, requestCount: -1 }).map((item) => item.code),
    ).toContain("INVALID_COUNT");
    expect(
      validateSyncRun({ ...syncRun, status: "RUNNING" }).map((item) => item.code),
    ).toContain("RUNNING_ALREADY_COMPLETED");
    expect(
      validateSyncRun({ ...syncRun, completedAt: null }).map((item) => item.code),
    ).toContain("TERMINAL_RUN_INCOMPLETE");
    expect(
      validateSyncRun({
        ...syncRun,
        startedAt: utc("2026-07-17T02:00:00.000Z"),
        completedAt: utc("2026-07-17T01:00:00.000Z"),
      }).map((item) => item.code),
    ).toContain("RUN_TIME_ORDER");
    const invalidTimestampRun = { ...syncRun, startedAt: "not-a-time" };
    // @ts-expect-error Runtime validation must reject an unbranded event timestamp.
    expect(validateSyncRun(invalidTimestampRun).map((item) => item.code)).toContain(
      "INVALID_UTC_FORMAT",
    );
  });

  it("enforces import operation, status, and terminal count invariants", () => {
    expect(
      validateImportRun({ ...importRun, operation: "IMPORT" }).map((item) => item.code),
    ).toContain("OPERATION_STATUS_MISMATCH");
    expect(
      validateImportRun({ ...importRun, successCount: 0, failureCount: 1 }).map(
        (item) => item.code,
      ),
    ).toContain("SUCCEEDED_WITH_FAILURES");
    expect(
      validateImportRun({ ...importRun, status: "PARTIAL", successCount: 1, failureCount: 0 }).map(
        (item) => item.code,
      ),
    ).toContain("PARTIAL_WITHOUT_MIXED_RESULTS");
    expect(
      validateImportRun({ ...importRun, status: "FAILED", successCount: 0, failureCount: 1 }),
    ).toEqual([]);
  });

  it("reports blank run metadata with a structured issue", () => {
    expect(validateSyncRun({ ...syncRun, operation: " " }).map((item) => item.code)).toContain(
      "BLANK_VALUE",
    );
  });
});

describe("source observation contracts", () => {
  it("requires a failure to reference exactly one run", () => {
    expect(
      validateRunEntryFailure({
        id: "failure-a1",
        syncRunId,
        importRunId,
        sourcePosition: 1,
        payloadHash: null,
        rawPayloadReference: null,
        errorCode: "SYNTHETIC_FAILURE",
        errorSummary: "Synthetic failure without raw payload",
        recordedAt: utc("2026-07-17T00:00:00.000Z"),
      }).map((item) => item.code),
    ).toContain("RUN_REFERENCE_COUNT");
  });

  it("rejects invalid failure source positions", () => {
    expect(
      validateRunEntryFailure({
        id: "failure-a2",
        syncRunId,
        importRunId: null,
        sourcePosition: 0,
        payloadHash: null,
        rawPayloadReference: null,
        errorCode: "SYNTHETIC_FAILURE",
        errorSummary: "Synthetic failure",
        recordedAt: utc("2026-07-17T00:00:00.000Z"),
      }).map((item) => item.code),
    ).toContain("INVALID_POSITION");
  });

  it("validates SourceRecord observation order without adding a second identity mapping", () => {
    const record = {
      id: sourceRecordId,
      externalIdentifierId,
      endpoint: "/synthetic/album/:id",
      context: {},
      contextHash: "synthetic-context-hash",
      normalizedPayloadHash: "synthetic-payload-hash",
      rawPayloadReference: null,
      parserVersion: "0.3A.1",
      mappingVersion: "not-implemented",
      firstObservedAt: utc("2026-07-17T01:00:00.000Z"),
      lastObservedAt: utc("2026-07-17T00:00:00.000Z"),
      normalizationStatus: "PARTIAL" as const,
      lastError: null,
    };
    expect(validateSourceRecord(record).map((item) => item.code)).toContain("OBSERVATION_ORDER");
    expect(Object.keys(record)).not.toContain("externalId");
  });

  it("requires the correct event time for the referenced run kind", () => {
    const issues = validateSourceFetchSnapshot({
      id: "snapshot-a1",
      sourceRecordId,
      syncRunId,
      importRunId: null,
      fetchedAt: null,
      importedAt: null,
      observedAt: utc("2026-07-17T00:00:00.000Z"),
      normalizedPayloadHash: "synthetic-payload-hash",
      validationStatus: "VALID",
      validationIssues: [],
    });
    expect(issues.map((item) => item.code)).toContain("MISSING_FETCH_TIME");
  });

  it("requires importedAt for an import snapshot", () => {
    expect(
      validateSourceFetchSnapshot({
        id: "snapshot-a2",
        sourceRecordId,
        syncRunId: null,
        importRunId,
        fetchedAt: null,
        importedAt: null,
        observedAt: utc("2026-07-17T00:00:00.000Z"),
        normalizedPayloadHash: "synthetic-payload-hash",
        validationStatus: "VALID",
        validationIssues: [],
      }).map((item) => item.code),
    ).toContain("MISSING_IMPORT_TIME");
  });

  it("keeps market channels as new-release provenance only", () => {
    const discovery = {
      id: "discovery-a1",
      albumId,
      source: "NETEASE" as const,
      sourceMarketChannel: "ZH" as const,
      sourceListEndpoint: "/synthetic/new-releases",
      firstDiscoveredAt: utc("2026-07-17T00:00:00.000Z"),
      lastDiscoveredAt: utc("2026-07-17T01:00:00.000Z"),
      lastSyncRunId: syncRunId,
    };
    expect(validateNewReleaseDiscovery(discovery)).toEqual([]);
    expect(Object.keys(discovery)).not.toEqual(expect.arrayContaining(["country", "language"]));
  });

  it("allows one album to have multiple independent market memberships", () => {
    const shared = {
      albumId,
      source: "NETEASE" as const,
      sourceListEndpoint: "/synthetic/new-releases",
      firstDiscoveredAt: utc("2026-07-17T00:00:00.000Z"),
      lastDiscoveredAt: utc("2026-07-17T01:00:00.000Z"),
      lastSyncRunId: syncRunId,
    };
    const memberships = [
      { ...shared, id: "discovery-a1", sourceMarketChannel: "ZH" as const },
      { ...shared, id: "discovery-a2", sourceMarketChannel: "EA" as const },
    ];
    expect(memberships.every((item) => validateNewReleaseDiscovery(item).length === 0)).toBe(true);
    expect(new Set(memberships.map((item) => item.sourceMarketChannel)).size).toBe(2);
  });

  it("rejects reversed discovery times", () => {
    expect(
      validateNewReleaseDiscovery({
        id: "discovery-a3",
        albumId,
        source: "NETEASE",
        sourceMarketChannel: "ALL",
        sourceListEndpoint: "/synthetic/new-releases",
        firstDiscoveredAt: utc("2026-07-17T02:00:00.000Z"),
        lastDiscoveredAt: utc("2026-07-17T01:00:00.000Z"),
        lastSyncRunId: syncRunId,
      }).map((item) => item.code),
    ).toContain("DISCOVERY_ORDER");
  });
});

describe("RYM snapshot publication boundary", () => {
  const snapshot: RymRatingSnapshot = {
    id: "rating-snapshot-a1",
    albumId,
    importRunId,
    sourceRowKey: "synthetic-row-1",
    rating: 0,
    ratingCount: 0,
    primaryGenres: [
      {
        termId: valueOf(parseTaxonomyTermId("taxonomy-internal-a1")),
        sourceValueAtObservation: "Synthetic Primary",
        position: 1,
      },
    ],
    secondaryGenres: [],
    descriptors: [],
    observedAt: null,
    importedAt: utc("2026-07-17T00:00:00.000Z"),
    normalizedContentHash: "synthetic-content-hash",
    isPublished: true,
  };

  it("preserves an explicitly supplied legal zero", () => {
    expect(
      validateRymRatingSnapshot(snapshot, { matchingResolved: true, taxonomyResolved: true }),
    ).toEqual([]);
  });

  it("keeps rating, count, and all three taxonomy groups in the same snapshot", () => {
    expect(snapshot).toMatchObject({ rating: 0, ratingCount: 0 });
    expect(snapshot.primaryGenres).toHaveLength(1);
    expect(snapshot.secondaryGenres).toEqual([]);
    expect(snapshot.descriptors).toEqual([]);
  });

  it("rejects publication before album matching is resolved", () => {
    expect(
      validateRymRatingSnapshot(snapshot, { matchingResolved: false, taxonomyResolved: true }).map(
        (item) => item.code,
      ),
    ).toContain("UNMATCHED_SNAPSHOT_PUBLISHED");
  });

  it("rejects publication while taxonomy decisions remain unresolved", () => {
    expect(
      validateRymRatingSnapshot(snapshot, { matchingResolved: true, taxonomyResolved: false }).map(
        (item) => item.code,
      ),
    ).toContain("UNRESOLVED_TAXONOMY_PUBLISHED");
  });

  it("validates rating values and taxonomy positions", () => {
    const issues = validateRymRatingSnapshot(
      {
        ...snapshot,
        rating: Number.POSITIVE_INFINITY,
        ratingCount: -1,
        primaryGenres: [
          { ...snapshot.primaryGenres[0], position: 0 },
          { ...snapshot.primaryGenres[0], position: 0 },
        ],
      },
      { matchingResolved: true, taxonomyResolved: true },
    );
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "INVALID_RATING",
        "INVALID_RATING_COUNT",
        "INVALID_POSITION",
        "DUPLICATE_POSITION",
      ]),
    );
  });
});

describe("matching history contracts", () => {
  const decision: MatchDecision = {
    id: valueOf(parseMatchDecisionId("decision-a1")),
    source: "RYM",
    sourceReferenceKey: "synthetic-import-row",
    externalIdentifierId: null,
    candidateAlbumId: albumId,
    status: "AUTO_MATCHED",
    strategyVersion: "synthetic-strategy-v1",
    score: 1,
    evidence: ["synthetic exact title"],
    decidedAt: utc("2026-07-17T00:00:00.000Z"),
    supersedesDecisionId: null,
  };

  it("requires matched decisions to retain their candidate", () => {
    expect(validateMatchDecision({ ...decision, candidateAlbumId: null })).toMatchObject([
      { code: "MATCH_WITHOUT_CANDIDATE" },
    ]);
  });

  it("prevents a decision from superseding itself", () => {
    expect(validateMatchDecision({ ...decision, supersedesDecisionId: decision.id })).toMatchObject(
      [{ code: "SELF_SUPERSESSION" }],
    );
  });

  it("rejects rejected candidates and non-finite scores", () => {
    const issues = validateMatchDecision({
      ...decision,
      status: "REJECTED",
      score: Number.POSITIVE_INFINITY,
    });
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["REJECTED_WITH_CANDIDATE", "INVALID_SCORE"]),
    );
  });

  it("requires manual MATCH and REJECT actions to have coherent album references", () => {
    const override: ManualOverride = {
      id: valueOf(parseManualOverrideId("override-a1")),
      source: "RYM",
      sourceReferenceKey: "synthetic-import-row",
      externalIdentifierId: null,
      albumId: null,
      action: "MATCH",
      reason: "Synthetic human decision",
      createdAt: utc("2026-07-17T00:00:00.000Z"),
      supersedesOverrideId: null,
    };
    expect(validateManualOverride(override)).toMatchObject([{ code: "MATCH_WITHOUT_ALBUM" }]);
    expect(
      validateManualOverride({ ...override, action: "REJECT", albumId }).map((item) => item.code),
    ).toContain("REJECT_WITH_ALBUM");
    expect(
      validateManualOverride({ ...override, supersedesOverrideId: override.id }).map(
        (item) => item.code,
      ),
    ).toContain("SELF_SUPERSESSION");
  });
});
