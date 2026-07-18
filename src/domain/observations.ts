import type {
  AlbumId,
  ExternalIdentifierId,
  ImportRunId,
  ManualOverrideId,
  MatchDecisionId,
  SourceRecordId,
  SyncRunId,
  TaxonomyTermId,
} from "@/domain/ids";
import {
  parseUtcIsoTimestamp,
  type UtcIsoTimestamp,
  type MappingVersion,
  type NeteaseMarketChannel,
  type ParserVersion,
  type SourceSystem,
} from "@/domain/sources";

export type SyncRunStatus = "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
export type ImportRunStatus = "VALIDATED" | "DRY_RUN" | "IMPORTED" | "PARTIAL" | "FAILED";
export type ImportRunOperation = "VALIDATE" | "DRY_RUN" | "IMPORT";
export type SourceNormalizationStatus = "VALID" | "PARTIAL" | "INVALID";
export type SnapshotValidationStatus = "VALID" | "PARTIAL" | "INVALID";
export type ManualOverrideAction = "MATCH" | "REJECT";

export interface SyncRun {
  readonly id: SyncRunId;
  readonly source: "NETEASE";
  readonly operation: string;
  readonly requestedScope: string;
  readonly startedAt: UtcIsoTimestamp;
  readonly completedAt: UtcIsoTimestamp | null;
  readonly status: SyncRunStatus;
  readonly sourceVersion: string | null;
  readonly parserVersion: ParserVersion;
  readonly normalizerVersion: string;
  readonly requestCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly errorSummary: string | null;
}

export interface ImportRun {
  readonly id: ImportRunId;
  readonly source: "RYM";
  readonly operation: ImportRunOperation;
  readonly requestedScope: string;
  readonly sourceDescription: string;
  readonly fileName: string;
  readonly fileChecksum: string;
  readonly startedAt: UtcIsoTimestamp;
  readonly completedAt: UtcIsoTimestamp | null;
  readonly importedAt: UtcIsoTimestamp;
  readonly sourceVersion: string | null;
  readonly normalizerVersion: string;
  readonly status: ImportRunStatus;
  readonly rowCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly errorSummary: string | null;
}

export interface SourceRecord {
  readonly id: SourceRecordId;
  readonly externalIdentifierId: ExternalIdentifierId;
  readonly endpoint: string | null;
  readonly context: Readonly<Record<string, string>>;
  readonly contextHash: string;
  readonly normalizedPayloadHash: string;
  readonly rawPayloadReference: string | null;
  readonly parserVersion: ParserVersion;
  readonly mappingVersion: MappingVersion;
  readonly firstObservedAt: UtcIsoTimestamp;
  readonly lastObservedAt: UtcIsoTimestamp;
  readonly normalizationStatus: SourceNormalizationStatus;
  readonly lastError: string | null;
}

export interface SourceFetchSnapshot {
  readonly id: string;
  readonly sourceRecordId: SourceRecordId;
  readonly syncRunId: SyncRunId | null;
  readonly importRunId: ImportRunId | null;
  readonly fetchedAt: UtcIsoTimestamp | null;
  readonly importedAt: UtcIsoTimestamp | null;
  readonly observedAt: UtcIsoTimestamp;
  readonly normalizedPayloadHash: string;
  readonly validationStatus: SnapshotValidationStatus;
  readonly validationIssues: readonly string[];
}

export interface RunEntryFailure {
  readonly id: string;
  readonly syncRunId: SyncRunId | null;
  readonly importRunId: ImportRunId | null;
  readonly sourcePosition: number | null;
  readonly payloadHash: string | null;
  readonly rawPayloadReference: string | null;
  readonly errorCode: string;
  readonly errorSummary: string;
  readonly recordedAt: UtcIsoTimestamp;
}

export interface NewReleaseDiscovery {
  readonly id: string;
  readonly albumId: AlbumId;
  readonly source: "NETEASE";
  readonly sourceMarketChannel: NeteaseMarketChannel;
  readonly sourceListEndpoint: string;
  readonly firstDiscoveredAt: UtcIsoTimestamp;
  readonly lastDiscoveredAt: UtcIsoTimestamp;
  readonly lastSyncRunId: SyncRunId;
}

export interface TaxonomyObservation {
  readonly termId: TaxonomyTermId;
  readonly sourceValueAtObservation: string;
  readonly position: number;
}

export interface RymRatingSnapshot {
  readonly id: string;
  readonly albumId: AlbumId;
  readonly importRunId: ImportRunId;
  readonly sourceRowKey: string;
  readonly rating: number | null;
  readonly ratingCount: number | null;
  readonly primaryGenres: readonly TaxonomyObservation[];
  readonly secondaryGenres: readonly TaxonomyObservation[];
  readonly descriptors: readonly TaxonomyObservation[];
  readonly observedAt: UtcIsoTimestamp | null;
  readonly importedAt: UtcIsoTimestamp;
  readonly normalizedContentHash: string;
  readonly isPublished: boolean;
}

export type MatchDecisionStatus =
  | "AUTO_MATCHED"
  | "NEEDS_REVIEW"
  | "MANUALLY_MATCHED"
  | "REJECTED";

export interface MatchDecision {
  readonly id: MatchDecisionId;
  readonly source: SourceSystem;
  readonly sourceReferenceKey: string;
  readonly externalIdentifierId: ExternalIdentifierId | null;
  readonly candidateAlbumId: AlbumId | null;
  readonly status: MatchDecisionStatus;
  readonly strategyVersion: string;
  readonly score: number | null;
  readonly evidence: readonly string[];
  readonly decidedAt: UtcIsoTimestamp;
  readonly supersedesDecisionId: MatchDecisionId | null;
}

export interface ManualOverride {
  readonly id: ManualOverrideId;
  readonly source: SourceSystem;
  readonly sourceReferenceKey: string;
  readonly externalIdentifierId: ExternalIdentifierId | null;
  readonly albumId: AlbumId | null;
  readonly action: ManualOverrideAction;
  readonly reason: string;
  readonly createdAt: UtcIsoTimestamp;
  readonly supersedesOverrideId: ManualOverrideId | null;
}

export interface ObservationValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

function validateNonBlank(
  value: string,
  path: string,
  issues: ObservationValidationIssue[],
): void {
  if (value.trim().length === 0) {
    issues.push({ path, code: "BLANK_VALUE", message: `${path} cannot be blank.` });
  }
}

function validateCount(
  value: number,
  path: string,
  issues: ObservationValidationIssue[],
): void {
  if (!Number.isInteger(value) || value < 0) {
    issues.push({
      path,
      code: "INVALID_COUNT",
      message: `${path} must be a non-negative integer.`,
    });
  }
}

function validateTimestamp(
  value: UtcIsoTimestamp,
  path: string,
  issues: ObservationValidationIssue[],
): boolean {
  const result = parseUtcIsoTimestamp(value);
  if (result.ok) return true;
  issues.push({ path, code: result.issue.code, message: result.issue.message });
  return false;
}

function validateNullableTimestamp(
  value: UtcIsoTimestamp | null,
  path: string,
  issues: ObservationValidationIssue[],
): boolean {
  return value === null || validateTimestamp(value, path, issues);
}

function validateRunCompletion(
  status: SyncRunStatus | ImportRunStatus,
  startedAt: UtcIsoTimestamp,
  completedAt: UtcIsoTimestamp | null,
  issues: ObservationValidationIssue[],
): void {
  const startedAtValid = validateTimestamp(startedAt, "startedAt", issues);
  const completedAtValid = validateNullableTimestamp(completedAt, "completedAt", issues);
  const running = status === "RUNNING";
  if (running && completedAt !== null) {
    issues.push({
      path: "completedAt",
      code: "RUNNING_ALREADY_COMPLETED",
      message: "A running sync cannot have completedAt.",
    });
  }
  if (!running && completedAt === null) {
    issues.push({
      path: "completedAt",
      code: "TERMINAL_RUN_INCOMPLETE",
      message: "A terminal run must have completedAt.",
    });
  }
  if (startedAtValid && completedAtValid && completedAt !== null && completedAt < startedAt) {
    issues.push({
      path: "completedAt",
      code: "RUN_TIME_ORDER",
      message: "completedAt cannot precede startedAt.",
    });
  }
}

function validateFinishedCounts(
  status: "SUCCEEDED" | "VALIDATED" | "DRY_RUN" | "IMPORTED" | "PARTIAL" | "FAILED",
  totalCount: number,
  successCount: number,
  failureCount: number,
  issues: ObservationValidationIssue[],
): void {
  const completedSuccessfully =
    status === "SUCCEEDED" ||
    status === "VALIDATED" ||
    status === "DRY_RUN" ||
    status === "IMPORTED";

  if (completedSuccessfully && failureCount > 0) {
    issues.push({
      path: "failureCount",
      code: "SUCCEEDED_WITH_FAILURES",
      message: "A successful terminal status cannot contain failed entries.",
    });
  }
  if (status === "FAILED" && successCount > 0) {
    issues.push({
      path: "successCount",
      code: "FAILED_WITH_SUCCESSES",
      message: "A failed run cannot contain successful entries.",
    });
  }
  if (status === "FAILED" && failureCount === 0) {
    issues.push({
      path: "failureCount",
      code: "FAILED_WITHOUT_FAILURES",
      message: "A failed run must contain at least one failed entry.",
    });
  }
  if (status === "PARTIAL" && (successCount === 0 || failureCount === 0)) {
    issues.push({
      path: "successCount|failureCount",
      code: "PARTIAL_WITHOUT_MIXED_RESULTS",
      message: "A partial run requires both successful and failed entries.",
    });
  }
  if (successCount + failureCount !== totalCount) {
    issues.push({
      path: "successCount|failureCount",
      code: "TERMINAL_COUNT_MISMATCH",
      message: "A terminal run must account for every requested entry.",
    });
  }
}

export function validateSyncRun(run: SyncRun): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateNonBlank(run.operation, "operation", issues);
  validateNonBlank(run.requestedScope, "requestedScope", issues);
  validateNonBlank(run.parserVersion, "parserVersion", issues);
  validateNonBlank(run.normalizerVersion, "normalizerVersion", issues);
  validateCount(run.requestCount, "requestCount", issues);
  validateCount(run.successCount, "successCount", issues);
  validateCount(run.failureCount, "failureCount", issues);
  if (run.successCount + run.failureCount > run.requestCount) {
    issues.push({
      path: "successCount|failureCount",
      code: "COUNT_EXCEEDS_REQUESTS",
      message: "Successful and failed entries cannot exceed requestCount.",
    });
  }
  if (run.status !== "RUNNING") {
    validateFinishedCounts(
      run.status,
      run.requestCount,
      run.successCount,
      run.failureCount,
      issues,
    );
  }
  validateRunCompletion(run.status, run.startedAt, run.completedAt, issues);
  return issues;
}

export function validateImportRun(run: ImportRun): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateNonBlank(run.requestedScope, "requestedScope", issues);
  validateNonBlank(run.sourceDescription, "sourceDescription", issues);
  validateNonBlank(run.fileName, "fileName", issues);
  validateNonBlank(run.fileChecksum, "fileChecksum", issues);
  validateNonBlank(run.normalizerVersion, "normalizerVersion", issues);
  validateCount(run.rowCount, "rowCount", issues);
  validateCount(run.successCount, "successCount", issues);
  validateCount(run.failureCount, "failureCount", issues);
  validateTimestamp(run.importedAt, "importedAt", issues);
  if (run.successCount + run.failureCount > run.rowCount) {
    issues.push({
      path: "successCount|failureCount",
      code: "COUNT_EXCEEDS_ROWS",
      message: "Successful and failed rows cannot exceed rowCount.",
    });
  }
  validateFinishedCounts(run.status, run.rowCount, run.successCount, run.failureCount, issues);
  const expectedStatus =
    run.operation === "VALIDATE" ? "VALIDATED" : run.operation === "DRY_RUN" ? "DRY_RUN" : "IMPORTED";
  if (
    run.status !== "PARTIAL" &&
    run.status !== "FAILED" &&
    run.status !== expectedStatus
  ) {
    issues.push({
      path: "operation|status",
      code: "OPERATION_STATUS_MISMATCH",
      message: `Operation ${run.operation} cannot complete with status ${run.status}.`,
    });
  }
  validateRunCompletion(run.status, run.startedAt, run.completedAt, issues);
  return issues;
}

function validateExactlyOneRunReference(
  syncRunId: SyncRunId | null,
  importRunId: ImportRunId | null,
  issues: ObservationValidationIssue[],
): void {
  if ((syncRunId === null) === (importRunId === null)) {
    issues.push({
      path: "syncRunId|importRunId",
      code: "RUN_REFERENCE_COUNT",
      message: "Exactly one run reference must be present.",
    });
  }
}

export function validateRunEntryFailure(
  failure: RunEntryFailure,
): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateExactlyOneRunReference(failure.syncRunId, failure.importRunId, issues);
  if (
    failure.sourcePosition !== null &&
    (!Number.isInteger(failure.sourcePosition) || failure.sourcePosition < 1)
  ) {
    issues.push({
      path: "sourcePosition",
      code: "INVALID_POSITION",
      message: "sourcePosition must be a positive integer or null.",
    });
  }
  validateNonBlank(failure.errorCode, "errorCode", issues);
  validateNonBlank(failure.errorSummary, "errorSummary", issues);
  validateTimestamp(failure.recordedAt, "recordedAt", issues);
  return issues;
}

export function validateSourceRecord(record: SourceRecord): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateNonBlank(record.contextHash, "contextHash", issues);
  validateNonBlank(record.normalizedPayloadHash, "normalizedPayloadHash", issues);
  validateNonBlank(record.parserVersion, "parserVersion", issues);
  validateNonBlank(record.mappingVersion, "mappingVersion", issues);
  const firstObservedAtValid = validateTimestamp(record.firstObservedAt, "firstObservedAt", issues);
  const lastObservedAtValid = validateTimestamp(record.lastObservedAt, "lastObservedAt", issues);
  if (firstObservedAtValid && lastObservedAtValid && record.firstObservedAt > record.lastObservedAt) {
    issues.push({
      path: "lastObservedAt",
      code: "OBSERVATION_ORDER",
      message: "lastObservedAt cannot precede firstObservedAt.",
    });
  }
  return issues;
}

export function validateSourceFetchSnapshot(
  snapshot: SourceFetchSnapshot,
): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateExactlyOneRunReference(snapshot.syncRunId, snapshot.importRunId, issues);
  validateNonBlank(snapshot.normalizedPayloadHash, "normalizedPayloadHash", issues);
  validateNullableTimestamp(snapshot.fetchedAt, "fetchedAt", issues);
  validateNullableTimestamp(snapshot.importedAt, "importedAt", issues);
  validateTimestamp(snapshot.observedAt, "observedAt", issues);
  if (snapshot.syncRunId !== null && snapshot.fetchedAt === null) {
    issues.push({
      path: "fetchedAt",
      code: "MISSING_FETCH_TIME",
      message: "A sync snapshot requires fetchedAt.",
    });
  }
  if (snapshot.importRunId !== null && snapshot.importedAt === null) {
    issues.push({
      path: "importedAt",
      code: "MISSING_IMPORT_TIME",
      message: "An import snapshot requires importedAt.",
    });
  }
  return issues;
}

export function validateNewReleaseDiscovery(
  discovery: NewReleaseDiscovery,
): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateNonBlank(discovery.sourceListEndpoint, "sourceListEndpoint", issues);
  const firstDiscoveredAtValid = validateTimestamp(
    discovery.firstDiscoveredAt,
    "firstDiscoveredAt",
    issues,
  );
  const lastDiscoveredAtValid = validateTimestamp(
    discovery.lastDiscoveredAt,
    "lastDiscoveredAt",
    issues,
  );
  if (
    firstDiscoveredAtValid &&
    lastDiscoveredAtValid &&
    discovery.firstDiscoveredAt > discovery.lastDiscoveredAt
  ) {
    issues.push({
      path: "lastDiscoveredAt",
      code: "DISCOVERY_ORDER",
      message: "lastDiscoveredAt cannot precede firstDiscoveredAt.",
    });
  }
  return issues;
}

function validateTaxonomyObservations(
  values: readonly TaxonomyObservation[],
  path: string,
  issues: ObservationValidationIssue[],
): void {
  const positions = new Set<number>();
  values.forEach((value, index) => {
    if (!Number.isInteger(value.position) || value.position < 1) {
      issues.push({
        path: `${path}[${index}].position`,
        code: "INVALID_POSITION",
        message: "Taxonomy positions must be positive integers.",
      });
    }
    if (positions.has(value.position)) {
      issues.push({
        path: `${path}[${index}].position`,
        code: "DUPLICATE_POSITION",
        message: `Taxonomy positions must be unique within ${path}.`,
      });
    }
    positions.add(value.position);
    validateNonBlank(
      value.sourceValueAtObservation,
      `${path}[${index}].sourceValueAtObservation`,
      issues,
    );
  });
}

export interface RymRatingSnapshotValidationContext {
  readonly matchingResolved: boolean;
  readonly taxonomyResolved: boolean;
}

export function validateRymRatingSnapshot(
  snapshot: RymRatingSnapshot,
  context: RymRatingSnapshotValidationContext,
): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateNonBlank(snapshot.sourceRowKey, "sourceRowKey", issues);
  validateNonBlank(snapshot.normalizedContentHash, "normalizedContentHash", issues);
  validateNullableTimestamp(snapshot.observedAt, "observedAt", issues);
  validateTimestamp(snapshot.importedAt, "importedAt", issues);
  if (snapshot.rating !== null && !Number.isFinite(snapshot.rating)) {
    issues.push({
      path: "rating",
      code: "INVALID_RATING",
      message: "A rating must be finite or null.",
    });
  }
  if (
    snapshot.ratingCount !== null &&
    (!Number.isInteger(snapshot.ratingCount) || snapshot.ratingCount < 0)
  ) {
    issues.push({
      path: "ratingCount",
      code: "INVALID_RATING_COUNT",
      message: "ratingCount must be a non-negative integer or null.",
    });
  }
  validateTaxonomyObservations(snapshot.primaryGenres, "primaryGenres", issues);
  validateTaxonomyObservations(snapshot.secondaryGenres, "secondaryGenres", issues);
  validateTaxonomyObservations(snapshot.descriptors, "descriptors", issues);
  if (snapshot.isPublished && !context.matchingResolved) {
    issues.push({
      path: "isPublished",
      code: "UNMATCHED_SNAPSHOT_PUBLISHED",
      message: "An unmatched RYM row cannot be published as a rating snapshot.",
    });
  }
  if (snapshot.isPublished && !context.taxonomyResolved) {
    issues.push({
      path: "isPublished",
      code: "UNRESOLVED_TAXONOMY_PUBLISHED",
      message: "A snapshot with unresolved taxonomy cannot be published.",
    });
  }
  return issues;
}

export function validateMatchDecision(
  decision: MatchDecision,
): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateNonBlank(decision.sourceReferenceKey, "sourceReferenceKey", issues);
  validateNonBlank(decision.strategyVersion, "strategyVersion", issues);
  validateTimestamp(decision.decidedAt, "decidedAt", issues);
  if (
    (decision.status === "AUTO_MATCHED" || decision.status === "MANUALLY_MATCHED") &&
    decision.candidateAlbumId === null
  ) {
    issues.push({
      path: "candidateAlbumId",
      code: "MATCH_WITHOUT_CANDIDATE",
      message: "A matched decision requires a candidate album.",
    });
  }
  if (decision.status === "REJECTED" && decision.candidateAlbumId !== null) {
    issues.push({
      path: "candidateAlbumId",
      code: "REJECTED_WITH_CANDIDATE",
      message: "A rejected decision cannot retain a candidate album.",
    });
  }
  if (decision.score !== null && !Number.isFinite(decision.score)) {
    issues.push({
      path: "score",
      code: "INVALID_SCORE",
      message: "Match score must be finite or null.",
    });
  }
  if (decision.supersedesDecisionId === decision.id) {
    issues.push({
      path: "supersedesDecisionId",
      code: "SELF_SUPERSESSION",
      message: "A decision cannot supersede itself.",
    });
  }
  return issues;
}

export function validateManualOverride(
  override: ManualOverride,
): readonly ObservationValidationIssue[] {
  const issues: ObservationValidationIssue[] = [];
  validateNonBlank(override.sourceReferenceKey, "sourceReferenceKey", issues);
  validateNonBlank(override.reason, "reason", issues);
  validateTimestamp(override.createdAt, "createdAt", issues);
  if (override.action === "MATCH" && override.albumId === null) {
    issues.push({
      path: "albumId",
      code: "MATCH_WITHOUT_ALBUM",
      message: "A MATCH override requires an album.",
    });
  }
  if (override.action === "REJECT" && override.albumId !== null) {
    issues.push({
      path: "albumId",
      code: "REJECT_WITH_ALBUM",
      message: "A REJECT override cannot retain an album.",
    });
  }
  if (override.supersedesOverrideId === override.id) {
    issues.push({
      path: "supersedesOverrideId",
      code: "SELF_SUPERSESSION",
      message: "An override cannot supersede itself.",
    });
  }
  return issues;
}
