import { toExternalDecimalId } from "@/domain/ids";
import {
  NETEASE_MARKET_CHANNELS,
  absent,
  explicitNull,
  invalid,
  parseUtcIsoTimestamp,
  present,
  type NeteaseMarketChannel,
  type SourceField,
  type UtcIsoTimestamp,
} from "@/domain/sources";
import {
  NETEASE_SOURCE_PARSER_VERSION,
  type NeteaseAlbumSourceDto,
  type NeteaseArtistSourceDto,
  type NeteaseNewReleaseRecordDto,
  type NeteaseParserResult,
  type NeteaseParserValidationIssue,
  type NeteaseTrackSourceDto,
} from "@/providers/netease/source-dto";

type UnknownRecord = Readonly<Record<string, unknown>>;

interface ObservedValue {
  readonly found: boolean;
  readonly value: unknown;
  readonly path: string;
}

interface ObservedArray {
  readonly values: readonly unknown[];
  readonly path: string;
}

export interface NeteaseNewReleaseParserContext {
  readonly requestedMarketChannel: NeteaseMarketChannel;
  readonly sourceListEndpoint: string;
  readonly fetchedAt: unknown;
}

export interface NeteaseNewReleaseRecordParserContext extends NeteaseNewReleaseParserContext {
  readonly sourcePosition: number;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function issue(
  issues: NeteaseParserValidationIssue[],
  path: string,
  code: string,
  reason: string,
): void {
  issues.push({ path, code, reason });
}

function readField(record: UnknownRecord, basePath: string, key: string): ObservedValue {
  return {
    found: hasOwn(record, key),
    value: record[key],
    path: basePath.length > 0 ? `${basePath}.${key}` : key,
  };
}

function readPath(root: UnknownRecord, path: readonly string[]): ObservedValue {
  let current: unknown = root;
  const traversed: string[] = [];
  for (const segment of path) {
    traversed.push(segment);
    if (!isRecord(current) || !hasOwn(current, segment)) {
      return { found: false, value: undefined, path: traversed.join(".") };
    }
    current = current[segment];
  }
  return { found: true, value: current, path: path.join(".") };
}

function selectPreferredSourceField<T>(
  candidates: readonly (() => SourceField<T>)[],
): SourceField<T> {
  let firstExplicitNull: SourceField<T> | null = null;
  for (const readCandidate of candidates) {
    const candidate = readCandidate();
    if (candidate.state === "PRESENT" || candidate.state === "INVALID") return candidate;
    if (candidate.state === "EXPLICIT_NULL" && firstExplicitNull === null) {
      firstExplicitNull = candidate;
    }
  }
  return firstExplicitNull === null ? absent() : firstExplicitNull;
}

function parseFallbackField<T>(
  record: UnknownRecord,
  basePath: string,
  keys: readonly string[],
  parseCandidate: (candidate: ObservedValue) => SourceField<T>,
): SourceField<T> {
  return selectPreferredSourceField(
    keys.map((key) => () => parseCandidate(readField(record, basePath, key))),
  );
}

function parseNonBlankString(
  observed: ObservedValue,
  issues: NeteaseParserValidationIssue[],
): SourceField<string> {
  if (!observed.found) return absent();
  if (observed.value === null) return explicitNull();
  if (typeof observed.value !== "string" || observed.value.trim().length === 0) {
    const reason = "Expected a non-blank string.";
    issue(issues, observed.path, "INVALID_STRING", reason);
    return invalid(observed.value, reason);
  }
  return present(observed.value);
}

function parseExternalId(
  observed: ObservedValue,
  issues: NeteaseParserValidationIssue[],
): SourceField<string> {
  if (!observed.found) return absent();
  if (observed.value === null) return explicitNull();
  const result = toExternalDecimalId(observed.value);
  if (!result.ok) {
    const reason = "Expected a non-negative decimal external ID.";
    issue(issues, observed.path, result.issue.code, reason);
    return invalid(observed.value, reason);
  }
  return present(result.value);
}

function parseInteger(
  observed: ObservedValue,
  issues: NeteaseParserValidationIssue[],
  minimum: number,
): SourceField<number> {
  if (!observed.found) return absent();
  if (observed.value === null) return explicitNull();

  let parsed: number | null = null;
  if (typeof observed.value === "number" && Number.isSafeInteger(observed.value)) {
    parsed = observed.value;
  } else if (typeof observed.value === "string" && /^\d+$/.test(observed.value)) {
    const numeric = Number(observed.value);
    if (Number.isSafeInteger(numeric)) parsed = numeric;
  }

  if (parsed === null || parsed < minimum) {
    const reason = `Expected a safe integer greater than or equal to ${minimum}.`;
    issue(issues, observed.path, "INVALID_INTEGER", reason);
    return invalid(observed.value, reason);
  }
  return present(parsed);
}

function parseDiscNumber(
  observed: ObservedValue,
  issues: NeteaseParserValidationIssue[],
): SourceField<number> {
  if (!observed.found) return absent();
  if (observed.value === null) return explicitNull();

  if (typeof observed.value === "string") {
    const match = observed.value.match(/\d+/);
    if (match) {
      return parseInteger({ ...observed, value: match[0] }, issues, 1);
    }
  }
  return parseInteger(observed, issues, 1);
}

function parseStringList(
  observed: ObservedValue,
  issues: NeteaseParserValidationIssue[],
): SourceField<readonly string[]> {
  if (!observed.found) return absent();
  if (observed.value === null) return explicitNull();

  const values = Array.isArray(observed.value) ? observed.value : [observed.value];
  const parsed: string[] = [];
  let hasInvalidItem = false;
  values.forEach((value, index) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      hasInvalidItem = true;
      issue(
        issues,
        `${observed.path}[${index}]`,
        "INVALID_STRING_ITEM",
        "Expected a non-blank string.",
      );
    } else {
      parsed.push(value);
    }
  });

  if (hasInvalidItem) {
    return invalid(observed.value, "One or more list items are not non-blank strings.");
  }
  return present(parsed);
}

function invalidArtist(rawValue: unknown, path: string): NeteaseArtistSourceDto {
  return {
    externalArtistId: invalid(rawValue, `Artist at ${path} is not an object.`),
    name: invalid(rawValue, `Artist at ${path} is not an object.`),
  };
}

function parseArtistRecord(
  raw: unknown,
  path: string,
  issues: NeteaseParserValidationIssue[],
): NeteaseArtistSourceDto {
  if (!isRecord(raw)) {
    issue(issues, path, "INVALID_ARTIST", "Expected an artist object.");
    return invalidArtist(raw, path);
  }
  return {
    externalArtistId: parseExternalId(readField(raw, path, "id"), issues),
    name: parseNonBlankString(readField(raw, path, "name"), issues),
  };
}

function parseArtists(
  observed: ObservedValue,
  issues: NeteaseParserValidationIssue[],
): SourceField<readonly NeteaseArtistSourceDto[]> {
  if (!observed.found) return absent();
  if (observed.value === null) return explicitNull();
  if (!Array.isArray(observed.value) && !isRecord(observed.value)) {
    const reason = "Expected an artist object or artist array.";
    issue(issues, observed.path, "INVALID_ARTIST_LIST", reason);
    return invalid(observed.value, reason);
  }
  const values = Array.isArray(observed.value) ? observed.value : [observed.value];
  return present(
    values.map((value, index) => parseArtistRecord(value, `${observed.path}[${index}]`, issues)),
  );
}

function invalidTrack(rawValue: unknown, path: string, sourcePosition: number): NeteaseTrackSourceDto {
  const reason = `Track at ${path} is not an object.`;
  return {
    externalTrackId: invalid(rawValue, reason),
    title: invalid(rawValue, reason),
    trackNumber: invalid(rawValue, reason),
    discNumber: invalid(rawValue, reason),
    artists: invalid(rawValue, reason),
    durationMs: invalid(rawValue, reason),
    sourcePosition,
  };
}

function parseTrackRecord(
  raw: unknown,
  path: string,
  sourcePosition: number,
  issues: NeteaseParserValidationIssue[],
): NeteaseTrackSourceDto {
  if (!isRecord(raw)) {
    issue(issues, path, "INVALID_TRACK", "Expected a track object.");
    return invalidTrack(raw, path, sourcePosition);
  }
  return {
    externalTrackId: parseExternalId(readField(raw, path, "id"), issues),
    title: parseNonBlankString(readField(raw, path, "name"), issues),
    trackNumber: parseFallbackField(raw, path, ["no", "trackNumber"], (candidate) =>
      parseInteger(candidate, issues, 1),
    ),
    discNumber: parseFallbackField(raw, path, ["cd", "disc"], (candidate) =>
      parseDiscNumber(candidate, issues),
    ),
    artists: parseFallbackField(raw, path, ["ar", "artists"], (candidate) =>
      parseArtists(candidate, issues),
    ),
    durationMs: parseFallbackField(raw, path, ["dt", "duration"], (candidate) =>
      parseInteger(candidate, issues, 0),
    ),
    sourcePosition,
  };
}

function parseTracks(
  observed: ObservedValue,
  issues: NeteaseParserValidationIssue[],
): SourceField<readonly NeteaseTrackSourceDto[]> {
  if (!observed.found) return absent();
  if (observed.value === null) return explicitNull();
  if (!Array.isArray(observed.value)) {
    const reason = "Expected a track array.";
    issue(issues, observed.path, "INVALID_TRACK_LIST", reason);
    return invalid(observed.value, reason);
  }
  return present(
    observed.value.map((value, index) =>
      parseTrackRecord(value, `${observed.path}[${index}]`, index + 1, issues),
    ),
  );
}

function parseObservedArray(
  observed: ObservedValue,
  issues: NeteaseParserValidationIssue[],
): SourceField<ObservedArray> {
  if (!observed.found) return absent();
  if (observed.value === null) return explicitNull();
  if (!Array.isArray(observed.value)) {
    const reason = "Expected an album array.";
    issue(issues, observed.path, "INVALID_ALBUM_LIST", reason);
    return invalid(observed.value, reason);
  }
  return present({ values: observed.value, path: observed.path });
}

function parseAlbumRecord(
  raw: unknown,
  path: string,
  issues: NeteaseParserValidationIssue[],
  trackOverride?: SourceField<readonly NeteaseTrackSourceDto[]>,
): NeteaseAlbumSourceDto | null {
  if (!isRecord(raw)) {
    issue(issues, path, "INVALID_ALBUM", "Expected an album object.");
    return null;
  }

  const tracks =
    trackOverride ?? parseTracks(readField(raw, path, "songs"), issues);
  return {
    externalAlbumId: parseExternalId(readField(raw, path, "id"), issues),
    title: parseNonBlankString(readField(raw, path, "name"), issues),
    aliases: parseFallbackField(raw, path, ["alias", "aliases", "transNames"], (candidate) =>
      parseStringList(candidate, issues),
    ),
    artists: parseFallbackField(raw, path, ["artists", "ar", "artist"], (candidate) =>
      parseArtists(candidate, issues),
    ),
    releaseTimestampMs: parseFallbackField(raw, path, ["publishTime", "releaseDate"], (candidate) =>
      parseInteger(candidate, issues, 0),
    ),
    rawAlbumType: parseNonBlankString(readField(raw, path, "type"), issues),
    rawSubType: parseFallbackField(raw, path, ["subType", "subtype"], (candidate) =>
      parseNonBlankString(candidate, issues),
    ),
    company: parseFallbackField(raw, path, ["company", "publishCompany"], (candidate) =>
      parseNonBlankString(candidate, issues),
    ),
    coverUrl: parseFallbackField(raw, path, ["picUrl", "coverUrl"], (candidate) =>
      parseNonBlankString(candidate, issues),
    ),
    reportedTrackCount: parseFallbackField(raw, path, ["size", "trackCount"], (candidate) =>
      parseInteger(candidate, issues, 0),
    ),
    tracks,
  };
}

function result<T>(
  data: T | null,
  issues: readonly NeteaseParserValidationIssue[],
): NeteaseParserResult<T> {
  return { data, issues, parserVersion: NETEASE_SOURCE_PARSER_VERSION };
}

export function parseNeteaseAlbumSource(
  input: unknown,
): NeteaseParserResult<NeteaseAlbumSourceDto> {
  const issues: NeteaseParserValidationIssue[] = [];
  return result(parseAlbumRecord(input, "album", issues), issues);
}

export function parseNeteaseAlbumDetailPayload(
  input: unknown,
): NeteaseParserResult<NeteaseAlbumSourceDto> {
  const issues: NeteaseParserValidationIssue[] = [];
  if (!isRecord(input)) {
    issue(issues, "$", "INVALID_RESPONSE", "Expected a response object.");
    return result<NeteaseAlbumSourceDto>(null, issues);
  }

  const album = readPath(input, ["album"]);
  if (!album.found) {
    issue(issues, "album", "ALBUM_ABSENT", "The detail response does not contain album.");
    return result<NeteaseAlbumSourceDto>(null, issues);
  }
  if (album.value === null) {
    issue(issues, "album", "ALBUM_NULL", "The detail response contains a null album.");
    return result<NeteaseAlbumSourceDto>(null, issues);
  }

  const tracks = selectPreferredSourceField([
    () => parseTracks(readPath(input, ["songs"]), issues),
    () => parseTracks(readPath(input, ["album", "songs"]), issues),
  ]);
  return result(parseAlbumRecord(album.value, "album", issues, tracks), issues);
}

function parseAlbumList(
  observed: SourceField<ObservedArray>,
  defaultPath: string,
  issues: NeteaseParserValidationIssue[],
): readonly NeteaseAlbumSourceDto[] | null {
  if (observed.state === "ABSENT") {
    issue(issues, defaultPath, "ALBUM_LIST_ABSENT", "The response does not contain an album list.");
    return null;
  }
  if (observed.state === "EXPLICIT_NULL") {
    issue(issues, defaultPath, "ALBUM_LIST_NULL", "The response contains only null album lists.");
    return null;
  }
  if (observed.state === "INVALID") return null;

  const albums: NeteaseAlbumSourceDto[] = [];
  observed.value.values.forEach((value, index) => {
    const album = parseAlbumRecord(value, `${observed.value.path}[${index}]`, issues);
    if (album !== null) albums.push(album);
  });
  return albums;
}

export function parseNeteaseAlbumSearchPayload(
  input: unknown,
): NeteaseParserResult<readonly NeteaseAlbumSourceDto[]> {
  const issues: NeteaseParserValidationIssue[] = [];
  if (!isRecord(input)) {
    issue(issues, "$", "INVALID_RESPONSE", "Expected a response object.");
    return result<readonly NeteaseAlbumSourceDto[]>(null, issues);
  }
  const albums = selectPreferredSourceField([
    () => parseObservedArray(readPath(input, ["result", "albums"]), issues),
    () => parseObservedArray(readPath(input, ["albums"]), issues),
  ]);
  return result(parseAlbumList(albums, "result.albums", issues), issues);
}

function validateNewReleaseContext(
  context: NeteaseNewReleaseParserContext,
  issues: NeteaseParserValidationIssue[],
): UtcIsoTimestamp | null {
  if (!NETEASE_MARKET_CHANNELS.includes(context.requestedMarketChannel)) {
    issue(issues, "requestedMarketChannel", "INVALID_CHANNEL", "Unsupported market channel.");
  }
  if (context.sourceListEndpoint.trim().length === 0) {
    issue(issues, "sourceListEndpoint", "INVALID_ENDPOINT", "Endpoint cannot be blank.");
  }
  const fetchedAt = parseUtcIsoTimestamp(context.fetchedAt);
  if (!fetchedAt.ok) {
    issue(issues, "fetchedAt", "INVALID_FETCH_TIME", fetchedAt.issue.message);
    return null;
  }
  return fetchedAt.value;
}

function validateNewReleasePosition(
  sourcePosition: number,
  issues: NeteaseParserValidationIssue[],
): void {
  if (!Number.isInteger(sourcePosition) || sourcePosition < 1) {
    issue(
      issues,
      "sourcePosition",
      "INVALID_SOURCE_POSITION",
      "sourcePosition must be a positive integer.",
    );
  }
}

export function parseNeteaseNewReleaseRecord(
  input: unknown,
  context: NeteaseNewReleaseRecordParserContext,
): NeteaseParserResult<NeteaseNewReleaseRecordDto> {
  const issues: NeteaseParserValidationIssue[] = [];
  const fetchedAt = validateNewReleaseContext(context, issues);
  validateNewReleasePosition(context.sourcePosition, issues);
  if (fetchedAt === null) return result<NeteaseNewReleaseRecordDto>(null, issues);
  const album = parseAlbumRecord(input, "album", issues);
  if (album === null) return result<NeteaseNewReleaseRecordDto>(null, issues);
  return result({ ...context, fetchedAt, album }, issues);
}

export function parseNeteaseNewReleasePayload(
  input: unknown,
  context: NeteaseNewReleaseParserContext,
): NeteaseParserResult<readonly NeteaseNewReleaseRecordDto[]> {
  const issues: NeteaseParserValidationIssue[] = [];
  if (!isRecord(input)) {
    issue(issues, "$", "INVALID_RESPONSE", "Expected a response object.");
    return result<readonly NeteaseNewReleaseRecordDto[]>(null, issues);
  }

  const fetchedAt = validateNewReleaseContext(context, issues);
  if (fetchedAt === null) return result<readonly NeteaseNewReleaseRecordDto[]>(null, issues);

  const observed = selectPreferredSourceField([
    () => parseObservedArray(readPath(input, ["albums"]), issues),
    () => parseObservedArray(readPath(input, ["monthData"]), issues),
    () => parseObservedArray(readPath(input, ["weekData"]), issues),
  ]);
  if (observed.state === "ABSENT") {
    issue(issues, "albums", "ALBUM_LIST_ABSENT", "The response does not contain an album list.");
    return result<readonly NeteaseNewReleaseRecordDto[]>(null, issues);
  }
  if (observed.state === "EXPLICIT_NULL") {
    issue(issues, "albums", "ALBUM_LIST_NULL", "The response contains only null album lists.");
    return result<readonly NeteaseNewReleaseRecordDto[]>(null, issues);
  }
  if (observed.state === "INVALID") {
    return result<readonly NeteaseNewReleaseRecordDto[]>(null, issues);
  }

  const records: NeteaseNewReleaseRecordDto[] = [];
  observed.value.values.forEach((value, index) => {
    const sourcePosition = index + 1;
    validateNewReleasePosition(sourcePosition, issues);
    const album = parseAlbumRecord(value, `${observed.value.path}[${index}]`, issues);
    if (album !== null) {
      records.push({
        requestedMarketChannel: context.requestedMarketChannel,
        sourceListEndpoint: context.sourceListEndpoint,
        fetchedAt,
        sourcePosition,
        album,
      });
    }
  });
  return result(records, issues);
}
